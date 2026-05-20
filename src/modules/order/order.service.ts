import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager, In } from 'typeorm';
import { randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { CheckoutSession, CheckoutSessionStatus } from './entities/checkout-session.entity';
import { Table } from '../table/entities/table.entity';
import { Product } from '../product/entities/product.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import {
  UpdateOrderStatusDto,
  RequestPaymentDto,
  PaySingleOrderDto,
  PayUnpaidOrdersByTableDto,
} from './dto/update-order-status.dto';
import {
  CheckoutPreviewDto,
  CheckoutStartDto,
  CheckoutCompleteDto,
  CheckoutCompleteStaffDto,
  CheckoutRequestBatchPaymentDto,
} from './dto/checkout.dto';
import { OrderStatus } from '../../common/enums/order-status.enum';
import { TableStatus } from '../../common/enums/table-status.enum';
import { ProductStatus } from '../../common/enums/product-status.enum';
import { ESTIMATED_WAIT_BARISTAS } from '../../common/constants';
import { SseService } from '../sse/sse.service';

const STATUS_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  [OrderStatus.PREPARING]: [OrderStatus.READY, OrderStatus.CANCELLED],
  [OrderStatus.READY]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
  [OrderStatus.COMPLETED]: [OrderStatus.CANCELLED],
};

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepo: Repository<OrderItem>,
    @InjectRepository(Table)
    private readonly tableRepo: Repository<Table>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    private readonly dataSource: DataSource,
    private readonly sseService: SseService,
  ) {}

  private buildDto(order: Order) {
    return {
      id: order.id,
      tableId: order.tableId,
      tableName: order.table?.name ?? null,
      tableToken: order.tableToken,
      status: order.status,
      paidStatus: order.paidStatus,
      items: (order.items || []).map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        productImageUrl: item.productImageUrl,
        price: item.price,
        quantity: item.quantity,
        subtotal: item.subtotal,
        note: item.note,
      })),
      totalAmount: order.totalAmount,
      estimateWaitMinutes: order.estimatedWaitMinutes,
      note: order.note,
      paymentRequested: order.paymentRequested,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  async getActiveQueue() {
    const orders = await this.orderRepo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.items', 'items')
      .leftJoinAndSelect('o.table', 'table')
      // Chỉ lấy các đơn hàng đang trong luồng phục vụ
      .where('o.status IN (:...statuses)', {
        statuses: [
          OrderStatus.PENDING,
          OrderStatus.CONFIRMED,
          OrderStatus.PREPARING,
          OrderStatus.READY,
        ],
      })
      // Đơn hàng cũ nhất xếp lên đầu (First In - First Out)
      .orderBy('o.createdAt', 'ASC')
      .getMany();

    return orders.map((o) => this.buildDto(o));
  }

  private async resolvePayableOrders(
    manager: EntityManager | undefined,
    tableToken: string,
    orderIds?: string[],
  ): Promise<{ table: Table; orders: Order[] }> {
    const tableRepo = manager ? manager.getRepository(Table) : this.tableRepo;
    const orderRepo = manager ? manager.getRepository(Order) : this.orderRepo;

    const table = await tableRepo.findOne({ where: { qrToken: tableToken } });
    if (!table) throw new NotFoundException('Bàn không tồn tại');

    const qb = orderRepo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.items', 'items')
      .leftJoinAndSelect('o.table', 'table')
      .where('o.tableToken = :tableToken', { tableToken })
      .andWhere('o.status != :cancelledStatus', { cancelledStatus: OrderStatus.CANCELLED })
      .andWhere('o.paidStatus = :paidStatus', { paidStatus: false })
      .orderBy('o.createdAt', 'ASC');

    let orders = await qb.getMany();

    if (orderIds?.length) {
      const uniqueIds = [...new Set(orderIds)];
      const map = new Map(orders.map((o) => [o.id, o]));
      orders = [];
      for (const id of uniqueIds) {
        const o = map.get(id);
        if (!o) {
          throw new BadRequestException(
            'Một số đơn không thuộc bàn hoặc đã kết thúc',
          );
        }
        orders.push(o);
      }
    }

    if (!orders.length) {
      throw new BadRequestException('Không có đơn nào để thanh toán gộp');
    }

    return { table, orders };
  }

  private async syncTableOccupancyAfterOrderChange(
    manager: EntityManager,
    tableId: string,
  ): Promise<void> {
    const tableRepo = manager.getRepository(Table);
    const orderRepo = manager.getRepository(Order);
    const remaining = await orderRepo
      .createQueryBuilder('o')
      .where('o.tableId = :tableId', { tableId })
      .andWhere('o.status != :cancelledStatus', { cancelledStatus: OrderStatus.CANCELLED })
      .andWhere('(o.paidStatus = :isUnpaid OR o.status != :completedStatus)', {
        isUnpaid: false,
        completedStatus: OrderStatus.COMPLETED,
      })
      .getCount();

    const table = await tableRepo.findOne({
      where: { id: tableId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!table) return;

    if (remaining === 0) {
      const shouldRotateToken = table.status === TableStatus.OCCUPIED;
      table.status = TableStatus.AVAILABLE;
      if (shouldRotateToken) {
        table.qrToken = uuidv4();
      }
    } else {
      table.status = TableStatus.OCCUPIED;
      // Không cần query latest order nữa
    }


    await tableRepo.save(table);
  }

  async computeEstimatedWait(): Promise<number> {
    // Tính tổng (quantity × prepTime) của tất cả item thuộc đơn CONFIRMED/PREPARING
    const result = await this.orderItemRepo
      .createQueryBuilder('oi')
      .select('SUM(oi.quantity * p.prepTime)', 'totalMinutes')
      .innerJoin('oi.order', 'o')
      .innerJoin('oi.product', 'p')
      .where('o.status IN (:...statuses)', {
        statuses: [OrderStatus.CONFIRMED, OrderStatus.PREPARING],
      })
      .getRawOne<{ totalMinutes: string }>();

    const totalMinutes = parseFloat(result?.totalMinutes ?? '0');
    if (!totalMinutes) return 0;
    return Math.ceil(totalMinutes / ESTIMATED_WAIT_BARISTAS);
  }

  private async computeEstimatedWaitForOrder(orderId: string) {
    const targetOrder = await this.orderRepo.findOne({
      where: { id: orderId },
      select: { id: true, status: true },
    });
    if (!targetOrder) throw new NotFoundException('Đơn hàng không tồn tại');

    if (
      targetOrder.status === OrderStatus.COMPLETED ||
      targetOrder.status === OrderStatus.CANCELLED ||
      targetOrder.status === OrderStatus.READY
    ) {
      return {
        mode: 'order' as const,
        orderId,
        status: targetOrder.status,
        estimatedMinutes: 0,
        orderPrepMinutes: 0,
        estimatedCompletionMinutes: 0,
      };
    }

    const queueStatuses = [
      OrderStatus.PENDING,
      OrderStatus.CONFIRMED,
      OrderStatus.PREPARING,
    ];

    const rows = await this.orderRepo
      .createQueryBuilder('o')
      .select('o.id', 'id')
      .addSelect('o.createdAt', 'createdAt')
      .addSelect('COALESCE(SUM(oi.quantity * p.prepTime), 0)', 'prepMinutes')
      .leftJoin('o.items', 'oi')
      .leftJoin('oi.product', 'p')
      .where('o.status IN (:...statuses)', { statuses: queueStatuses })
      .groupBy('o.id')
      .addGroupBy('o.createdAt')
      .orderBy('o.createdAt', 'ASC')
      .addOrderBy('o.id', 'ASC')
      .getRawMany<{ id: string; createdAt: string; prepMinutes: string }>();

    const targetIndex = rows.findIndex((r) => r.id === orderId);
    if (targetIndex < 0) {
      // Trường hợp trạng thái đơn vừa chuyển trong lúc đang tính
      return {
        mode: 'order' as const,
        orderId,
        status: targetOrder.status,
        estimatedMinutes: 0,
        orderPrepMinutes: 0,
        estimatedCompletionMinutes: 0,
      };
    }

    const queueBeforeMinutes = rows
      .slice(0, targetIndex)
      .reduce((sum, r) => sum + parseFloat(r.prepMinutes || '0'), 0);
    const ownPrepMinutes = parseFloat(rows[targetIndex]?.prepMinutes || '0');

    return {
      mode: 'order' as const,
      orderId,
      status: targetOrder.status,
      // Thời gian chờ để order này bắt đầu được xử lý
      estimatedMinutes: Math.ceil(queueBeforeMinutes / ESTIMATED_WAIT_BARISTAS),
      // Thời gian prep riêng của order (chưa chia barista)
      orderPrepMinutes: Math.ceil(ownPrepMinutes),
      // ETA hoàn thành order này (chờ + prep)
      estimatedCompletionMinutes: Math.ceil(
        (queueBeforeMinutes + ownPrepMinutes) / ESTIMATED_WAIT_BARISTAS,
      ),
    };
  }

  async create(dto: CreateOrderDto) {
    return this.dataSource.transaction(async (manager) => {
      const table = await manager.findOne(Table, {
        where: { qrToken: dto.tableToken },
        lock: { mode: 'pessimistic_write' },
      });
      if (!table) throw new NotFoundException('Bàn không tồn tại');

      const orderItems: Partial<OrderItem>[] = [];
      let totalAmount = 0;

      for (const itemDto of dto.items) {
        const product = await manager.findOneBy(Product, { id: itemDto.productId });
        if (!product) {
          throw new NotFoundException(`Sản phẩm không tồn tại`);
        }
        if (product.status !== ProductStatus.AVAILABLE) {
          throw new BadRequestException(
            `Sản phẩm ${product.name} hiện không còn hàng`,
          );
        }
        const subtotal = product.price * itemDto.quantity;
        totalAmount += subtotal;
        orderItems.push({
          productId: product.id,
          productName: product.name,
          productImageUrl: product.imageUrl,
          price: product.price,
          quantity: itemDto.quantity,
          subtotal,
          note: itemDto.note ?? null,
        });
      }

      // computeEstimatedWait dùng connection ngoài transaction — intentional.
      // Nó tính trên các đơn CONFIRMED/PREPARING đã commit, không liên quan
      // đến đơn đang được tạo. Hoạt động đúng với PostgreSQL Read Committed (mặc định).
      const estimatedWaitMinutes = await this.computeEstimatedWait();

      const order = manager.create(Order, {
        tableId: table.id,
        tableToken: dto.tableToken,
        status: OrderStatus.PENDING,
        totalAmount,
        estimatedWaitMinutes,
        note: dto.note ?? null,
        items: orderItems as OrderItem[],
      });
      const saved = await manager.save(Order, order);

      table.status = TableStatus.OCCUPIED;
      await manager.save(Table, table);

      const full = await manager.findOne(Order, {
        where: { id: saved.id },
        relations: ['items', 'table'],
      });
      const result = this.buildDto(full!);

      this.sseService.emit({
        type: 'new_order',
        data: { orderId: result.id, tableId: result.tableId, tableName: result.tableName },
      });

      return result;
    });
  }

  async page(query: {
    pageNo?: number;
    pageSize?: number;
    status?: OrderStatus;
    tableId?: string;
    date?: string;
  }) {
    const { pageNo = 1, pageSize = 20, status, tableId, date } = query;
    const skip = (pageNo - 1) * pageSize;

    let dateStart: Date | undefined;
    let dateEnd: Date | undefined;
    if (date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new BadRequestException('Tham số date phải có định dạng YYYY-MM-DD');
      }
      dateStart = new Date(`${date}T00:00:00.000+07:00`);
      dateEnd = new Date(`${date}T23:59:59.999+07:00`);
      if (Number.isNaN(dateStart.getTime()) || Number.isNaN(dateEnd.getTime())) {
        throw new BadRequestException('Tham số date không hợp lệ');
      }
    }

    const applyFilters = (qb: ReturnType<typeof this.orderRepo.createQueryBuilder>) => {
      if (status) qb.andWhere('o.status = :status', { status });
      if (tableId) qb.andWhere('o.tableId = :tableId', { tableId });
      if (dateStart && dateEnd) {
        qb.andWhere('o.createdAt >= :dateStart AND o.createdAt <= :dateEnd', { dateStart, dateEnd });
      }
      return qb;
    };

    // Count riêng để tránh Cartesian product khi JOIN 1-to-many
    const total = await applyFilters(
      this.orderRepo.createQueryBuilder('o'),
    ).getCount();

    const orders = await applyFilters(
      this.orderRepo
        .createQueryBuilder('o')
        .leftJoinAndSelect('o.items', 'items')
        .leftJoinAndSelect('o.table', 'table'),
    )
      .orderBy('o.createdAt', 'DESC')
      .skip(skip)
      .take(pageSize)
      .getMany();

    return { list: orders.map((o) => this.buildDto(o)), total };
  }

  async detail(id: string) {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: ['items', 'table'],
    });
    if (!order) throw new NotFoundException('Đơn hàng không tồn tại');
    return this.buildDto(order);
  }

  async byToken(token: string) {
    const orders = await this.orderRepo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.items', 'items')
      .leftJoinAndSelect('o.table', 'table')
      .where('o.tableToken = :token', { token })
      .andWhere('o.status != :cancelledStatus', { cancelledStatus: OrderStatus.CANCELLED })
      .andWhere('(o.paidStatus = :isUnpaid OR o.status != :completedStatus)', {
        isUnpaid: false,
        completedStatus: OrderStatus.COMPLETED,
      })
      .orderBy('o.createdAt', 'DESC')
      .getMany();
    return orders.map((o) => this.buildDto(o));
  }

  async estimatedWait(orderId?: string) {
    if (orderId) {
      return this.computeEstimatedWaitForOrder(orderId);
    }
    return { mode: 'system', estimatedMinutes: await this.computeEstimatedWait() };
  }

  async updateStatus(dto: UpdateOrderStatusDto) {
    return this.dataSource.transaction(async (manager) => {
      const lockedOrder = await manager.findOne(Order, {
        where: { id: dto.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!lockedOrder) throw new NotFoundException('Đơn hàng không tồn tại');

      const allowed = STATUS_TRANSITIONS[lockedOrder.status];
      if (!allowed || !allowed.includes(dto.status)) {
        throw new BadRequestException('Không thể chuyển trạng thái đơn hàng');
      }

      lockedOrder.status = dto.status;
      await manager.save(Order, lockedOrder);

      if (
        dto.status === OrderStatus.COMPLETED ||
        dto.status === OrderStatus.CANCELLED
      ) {
        await this.syncTableOccupancyAfterOrderChange(manager, lockedOrder.tableId);
      }

      const full = await manager.findOne(Order, {
        where: { id: lockedOrder.id },
        relations: ['items', 'table'],
      });
      const result = this.buildDto(full!);

      this.sseService.emit({
        type: 'order_status_changed',
        data: { orderId: result.id, status: result.status, tableId: result.tableId, tableName: result.tableName },
      });

      return result;
    });
  }

  private parseDateRange(from?: string, to?: string): { start: Date; end: Date } | null {
    if (!from && !to) return null;
    const start = from ? new Date(`${from}T00:00:00.000+07:00`) : new Date(0);
    const end = to ? new Date(`${to}T23:59:59.999+07:00`) : new Date();
    return { start, end };
  }

  async statsRevenue(query: { period?: 'day' | 'week' | 'month'; from?: string; to?: string }) {
    const { period = 'day', from, to } = query;

    const formatMap: Record<string, string> = {
      day: 'YYYY-MM-DD',
      week: 'IYYY-IW',
      month: 'YYYY-MM',
    };
    const groupFmt = formatMap[period] ?? 'YYYY-MM-DD';

    // groupFmt đến từ enum lookup nội bộ (không từ user) nên an toàn khi inline
    const dateTrunc = `TO_CHAR(o."createdAt" AT TIME ZONE 'Asia/Ho_Chi_Minh', '${groupFmt}')`;

    const qb = this.orderRepo
      .createQueryBuilder('o')
      .select(dateTrunc, 'date')
      .addSelect('SUM(o.totalAmount)', 'revenue')
      .addSelect('COUNT(o.id)', 'orderCount')
      .where('o.paidStatus = :paidStatus', { paidStatus: true })
      .andWhere('o.status != :cancelledStatus', { cancelledStatus: OrderStatus.CANCELLED })
      .groupBy(dateTrunc)
      .orderBy('date', 'ASC');

    const range = this.parseDateRange(from, to);
    if (range) {
      qb.andWhere('o.createdAt >= :start AND o.createdAt <= :end', range);
    }

    const rows = await qb.getRawMany<{ date: string; revenue: string; orderCount: string }>();

    const data = rows.map((r) => ({
      date: r.date,
      revenue: parseInt(r.revenue ?? '0', 10),
      orderCount: parseInt(r.orderCount ?? '0', 10),
    }));

    return {
      totalRevenue: data.reduce((s, r) => s + r.revenue, 0),
      totalOrders: data.reduce((s, r) => s + r.orderCount, 0),
      data,
    };
  }

  async statsTopProducts(query: { limit?: number; from?: string; to?: string }) {
    const { limit = 10, from, to } = query;

    const qb = this.orderItemRepo
      .createQueryBuilder('oi')
      .select('oi.productId', 'productId')
      .addSelect('oi.productName', 'productName')
      .addSelect('SUM(oi.quantity)', 'totalQuantity')
      .addSelect('SUM(oi.subtotal)', 'totalRevenue')
      .innerJoin('oi.order', 'o')
      .where('o.paidStatus = :paidStatus', { paidStatus: true })
      .andWhere('o.status != :cancelledStatus', { cancelledStatus: OrderStatus.CANCELLED })
      .groupBy('oi.productId')
      .addGroupBy('oi.productName')
      .orderBy('totalQuantity', 'DESC')
      .limit(limit);

    const range = this.parseDateRange(from, to);
    if (range) {
      qb.andWhere('o.createdAt >= :start AND o.createdAt <= :end', range);
    }

    const rows = await qb.getRawMany<{
      productId: string;
      productName: string;
      totalQuantity: string;
      totalRevenue: string;
    }>();

    return rows.map((r) => ({
      productId: r.productId,
      productName: r.productName,
      totalQuantity: parseInt(r.totalQuantity ?? '0', 10),
      totalRevenue: parseInt(r.totalRevenue ?? '0', 10),
    }));
  }

  async requestPayment(dto: RequestPaymentDto) {
    const order = await this.orderRepo.findOneBy({ id: dto.orderId });
    if (!order) throw new NotFoundException('Đơn hàng không tồn tại');
    if (order.paidStatus || order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Đơn hàng đã kết thúc');
    }
    if (order.paymentRequested) {
      return { message: 'Đã gửi yêu cầu thanh toán' };
    }
    order.paymentRequested = true;
    await this.orderRepo.save(order);

    const table = await this.tableRepo.findOneBy({ id: order.tableId });
    this.sseService.emit({
      type: 'payment_request',
      data: {
        orderId: order.id,
        tableId: order.tableId,
        tableName: table?.name ?? null,
      },
    });

    return { message: 'Đã gửi yêu cầu thanh toán' };
  }

  async paySingleOrder(dto: PaySingleOrderDto) {
    return this.dataSource.transaction(async (manager) => {
      const order = await manager.findOne(Order, {
        where: { id: dto.orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) throw new NotFoundException('Đơn hàng không tồn tại');
      if (order.status === OrderStatus.CANCELLED) {
        throw new BadRequestException('Đơn hàng đã huỷ, không thể thanh toán');
      }

      if (order.paidStatus) {
        return {
          orderId: order.id,
          paidStatus: true,
          message: 'Đơn hàng đã được thanh toán trước đó',
        };
      }

      order.paidStatus = true;
      order.paymentRequested = false;
      await manager.save(Order, order);
      await this.syncTableOccupancyAfterOrderChange(manager, order.tableId);

      return {
        orderId: order.id,
        paidStatus: true,
        message: 'Đã ghi nhận thanh toán đơn hàng',
      };
    });
  }

  async payUnpaidOrdersByTable(dto: PayUnpaidOrdersByTableDto) {
    return this.dataSource.transaction(async (manager) => {
      const table = await manager.findOne(Table, {
        where: { qrToken: dto.tableToken },
        lock: { mode: 'pessimistic_write' },
      });
      if (!table) throw new NotFoundException('Bàn không tồn tại');

      const orders = await manager
        .getRepository(Order)
        .createQueryBuilder('o')
        .where('o.tableId = :tableId', { tableId: table.id })
        .andWhere('o.status != :cancelledStatus', { cancelledStatus: OrderStatus.CANCELLED })
        .andWhere('o.paidStatus = :isUnpaid', { isUnpaid: false })
        .getMany();

      for (const order of orders) {
        order.paidStatus = true;
        order.paymentRequested = false;
      }
      if (orders.length) {
        await manager.save(Order, orders);
      }

      await this.syncTableOccupancyAfterOrderChange(manager, table.id);

      return {
        tableToken: dto.tableToken,
        paidOrderCount: orders.length,
        orderIds: orders.map((o) => o.id),
        message: 'Đã ghi nhận thanh toán gộp theo bàn',
      };
    });
  }

  async checkoutPreview(dto: CheckoutPreviewDto) {
    const { table, orders } = await this.resolvePayableOrders(
      undefined,
      dto.tableToken,
      dto.orderIds,
    );
    const totalAmount = orders.reduce((s, o) => s + o.totalAmount, 0);
    return {
      tableId: table.id,
      tableName: table.name,
      tableToken: dto.tableToken,
      orderIds: orders.map((o) => o.id),
      totalAmount,
      orders: orders.map((o) => this.buildDto(o)),
    };
  }

  async checkoutStart(dto: CheckoutStartDto) {
    return this.dataSource.transaction(async (manager) => {
      const { table, orders } = await this.resolvePayableOrders(
        manager,
        dto.tableToken,
        dto.orderIds,
      );
      const totalAmount = orders.reduce((s, o) => s + o.totalAmount, 0);
      const ttlMinutes = dto.ttlMinutes ?? 15;
      const clientSecret = randomBytes(24).toString('hex');
      const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

      const session = manager.create(CheckoutSession, {
        tableToken: dto.tableToken,
        tableId: table.id,
        orderIds: orders.map((o) => o.id),
        totalAmount,
        status: CheckoutSessionStatus.PENDING,
        clientSecret,
        expiresAt,
      });
      const saved = await manager.save(CheckoutSession, session);

      return {
        sessionId: saved.id,
        clientSecret: saved.clientSecret,
        tableToken: saved.tableToken,
        tableId: saved.tableId,
        orderIds: saved.orderIds,
        totalAmount: saved.totalAmount,
        expiresAt: saved.expiresAt,
        orders: orders.map((o) => this.buildDto(o)),
      };
    });
  }

  private async finalizeCheckoutSessionLocked(
    manager: EntityManager,
    session: CheckoutSession,
  ) {
    const orderRepo = manager.getRepository(Order);
    const orders: Order[] = [];

    for (const id of session.orderIds) {
      const order = await orderRepo.findOne({
        where: { id },
        relations: ['items', 'table'],
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) {
        throw new BadRequestException(`Đơn ${id} không tồn tại`);
      }
      if (order.tableToken !== session.tableToken) {
        throw new BadRequestException('Đơn không khớp bàn');
      }
      if (
        order.paidStatus ||
        order.status === OrderStatus.CANCELLED
      ) {
        throw new BadRequestException(
          `Đơn ${id} đã kết thúc, không thể thanh toán gộp`,
        );
      }
      orders.push(order);
    }

    for (const order of orders) {
      order.paidStatus = true;
      order.paymentRequested = false;
      await manager.save(Order, order);
    }

    session.status = CheckoutSessionStatus.COMPLETED;
    await manager.save(CheckoutSession, session);

    await this.syncTableOccupancyAfterOrderChange(manager, session.tableId);

    const fullOrders = await orderRepo.find({
      where: { id: In(session.orderIds) },
      relations: ['items', 'table'],
    });
    const byId = new Map(fullOrders.map((o) => [o.id, o]));
    const ordered = session.orderIds.map((id) => byId.get(id)!).filter(Boolean);

    return {
      idempotent: false as const,
      sessionId: session.id,
      orderIds: session.orderIds,
      totalAmount: session.totalAmount,
      orders: ordered.map((o) => this.buildDto(o)),
    };
  }

  async checkoutComplete(dto: CheckoutCompleteDto) {
    return this.dataSource.transaction(async (manager) => {
      const sessRepo = manager.getRepository(CheckoutSession);
      const session = await sessRepo.findOne({
        where: { id: dto.sessionId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!session) throw new NotFoundException('Phiên thanh toán không tồn tại');

      if (session.status === CheckoutSessionStatus.COMPLETED) {
        const orderRepo = manager.getRepository(Order);
        const fullOrders = await orderRepo.find({
          where: { id: In(session.orderIds) },
          relations: ['items', 'table'],
        });
        const byId = new Map(fullOrders.map((o) => [o.id, o]));
        const ordered = session.orderIds.map((id) => byId.get(id)!).filter(Boolean);
        return {
          idempotent: true as const,
          sessionId: session.id,
          orderIds: session.orderIds,
          totalAmount: session.totalAmount,
          orders: ordered.map((o) => this.buildDto(o)),
        };
      }

      if (new Date() > session.expiresAt) {
        throw new BadRequestException('Phiên thanh toán đã hết hạn');
      }
      if (
        session.tableToken !== dto.tableToken ||
        session.clientSecret !== dto.clientSecret
      ) {
        throw new BadRequestException('Thông tin phiên thanh toán không hợp lệ');
      }

      const result = await this.finalizeCheckoutSessionLocked(manager, session);

      this.sseService.emit({
        type: 'payment_completed',
        data: {
          sessionId: result.sessionId,
          tableId: session.tableId,
          tableToken: session.tableToken,
          orderIds: result.orderIds,
          totalAmount: result.totalAmount,
        },
      });

      for (const o of result.orders) {
        this.sseService.emit({
          type: 'order_status_changed',
          data: {
            orderId: o.id,
            status: o.status,
            tableId: o.tableId,
            tableName: o.tableName,
          },
        });
      }

      return result;
    });
  }

  async checkoutCompleteStaff(dto: CheckoutCompleteStaffDto) {
    return this.dataSource.transaction(async (manager) => {
      const sessRepo = manager.getRepository(CheckoutSession);
      const session = await sessRepo.findOne({
        where: { id: dto.sessionId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!session) throw new NotFoundException('Phiên thanh toán không tồn tại');

      if (session.status === CheckoutSessionStatus.COMPLETED) {
        const orderRepo = manager.getRepository(Order);
        const fullOrders = await orderRepo.find({
          where: { id: In(session.orderIds) },
          relations: ['items', 'table'],
        });
        const byId = new Map(fullOrders.map((o) => [o.id, o]));
        const ordered = session.orderIds.map((id) => byId.get(id)!).filter(Boolean);
        return {
          idempotent: true as const,
          sessionId: session.id,
          orderIds: session.orderIds,
          totalAmount: session.totalAmount,
          orders: ordered.map((o) => this.buildDto(o)),
        };
      }

      if (new Date() > session.expiresAt) {
        throw new BadRequestException('Phiên thanh toán đã hết hạn');
      }

      const result = await this.finalizeCheckoutSessionLocked(manager, session);

      this.sseService.emit({
        type: 'payment_completed',
        data: {
          sessionId: result.sessionId,
          tableId: session.tableId,
          tableToken: session.tableToken,
          orderIds: result.orderIds,
          totalAmount: result.totalAmount,
        },
      });

      for (const o of result.orders) {
        this.sseService.emit({
          type: 'order_status_changed',
          data: {
            orderId: o.id,
            status: o.status,
            tableId: o.tableId,
            tableName: o.tableName,
          },
        });
      }

      return result;
    });
  }

  async requestPaymentBatch(dto: CheckoutRequestBatchPaymentDto) {
    const { orders } = await this.resolvePayableOrders(
      undefined,
      dto.tableToken,
      dto.orderIds,
    );
    const table = await this.tableRepo.findOne({
      where: { qrToken: dto.tableToken },
    });
    const totalAmount = orders.reduce((s, o) => s + o.totalAmount, 0);

    for (const order of orders) {
      if (!order.paymentRequested) {
        order.paymentRequested = true;
        await this.orderRepo.save(order);
      }
    }

    this.sseService.emit({
      type: 'payment_request_batch',
      data: {
        orderIds: orders.map((o) => o.id),
        tableId: table?.id ?? null,
        tableName: table?.name ?? null,
        totalAmount,
      },
    });

    return {
      message: 'Đã gửi yêu cầu thanh toán gộp',
      orderIds: orders.map((o) => o.id),
      totalAmount,
    };
  }
}
