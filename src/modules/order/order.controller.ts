import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Query,
  Param,
  HttpCode,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiQuery, ApiOkResponse } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { OrderService } from './order.service';
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
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { OrderStatus } from '../../common/enums/order-status.enum';

@ApiTags('Order')
@Controller('order')
export class OrderController {
  constructor(private readonly orderService: OrderService) { }

  @Post('create')
  @Public()
  @ApiOkResponse({
    description: 'Create order success',
    schema: {
      example: {
        code: 201,
        message: 'success',
        data: {
          id: 'uuid',
          tableId: 'uuid',
          tableName: 'Ban 01',
          tableToken: 'uuid-v4',
          status: 'PENDING',
          items: [],
          totalAmount: 70000,
          estimateWaitMinutes: 12,
          note: null,
          paymentRequested: false,
          createdAt: '2026-05-05T12:00:00.000Z',
          updatedAt: '2026-05-05T12:00:00.000Z',
        },
      },
    },
  })
  create(@Body() dto: CreateOrderDto) {
    return this.orderService.create(dto);
  }

  @Get('active')
  @ApiBearerAuth('JWT-auth')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  @ApiOkResponse({ description: 'Danh sách đơn hàng đang hoạt động' })
  getActiveQueue() {
    return this.orderService.getActiveQueue();
  }

  @Get('page')
  @ApiBearerAuth('JWT-auth')
  @ApiQuery({ name: 'pageNo', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiQuery({ name: 'status', required: false, enum: OrderStatus })
  @ApiQuery({ name: 'tableId', required: false })
  @ApiQuery({ name: 'date', required: false, description: 'YYYY-MM-DD' })
  @ApiOkResponse({
    description: 'Paginated orders',
    schema: {
      example: {
        code: 200,
        message: 'success',
        data: { list: [], total: 0 },
      },
    },
  })
  page(
    @Query('pageNo') pageNo?: number,
    @Query('pageSize') pageSize?: number,
    @Query('status') status?: OrderStatus,
    @Query('tableId') tableId?: string,
    @Query('date') date?: string,
  ) {
    return this.orderService.page({
      pageNo: pageNo ? Number(pageNo) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
      status,
      tableId,
      date,
    });
  }

  @Get('detail')
  @ApiBearerAuth('JWT-auth')
  @ApiQuery({ name: 'id', required: true })
  @ApiOkResponse({
    description: 'Order detail',
    schema: {
      example: {
        code: 200,
        message: 'success',
        data: {
          id: 'uuid',
          tableId: 'uuid',
          tableName: 'Ban 01',
          tableToken: 'uuid-v4',
          status: 'PREPARING',
          items: [
            {
              id: 'uuid',
              productId: 'uuid',
              productName: 'Ca phe sua',
              productImageUrl: null,
              price: 35000,
              quantity: 2,
              subtotal: 70000,
              note: 'it da',
            },
          ],
          totalAmount: 70000,
          estimateWaitMinutes: 8,
          note: null,
          paymentRequested: false,
          createdAt: '2026-05-05T12:00:00.000Z',
          updatedAt: '2026-05-05T12:05:00.000Z',
        },
      },
    },
  })
  detail(@Query('id') id: string) {
    return this.orderService.detail(id);
  }

  @Get('by-token/:token')
  @Public()
  @SkipThrottle()
  @ApiOkResponse({
    description: 'Active orders by table token',
    schema: {
      example: {
        code: 200,
        message: 'success',
        data: [],
      },
    },
  })
  byToken(@Param('token') token: string) {
    return this.orderService.byToken(token);
  }

  @Get('estimated-wait')
  @Public()
  @SkipThrottle()
  @ApiQuery({
    name: 'orderId',
    required: false,
    description:
      'Nếu truyền orderId: trả thời gian chờ theo order đó. Nếu không truyền: trả tổng queue hiện tại của quán.',
  })
  @ApiOkResponse({
    description: 'Estimated wait (system or per-order)',
    schema: {
      example: {
        code: 200,
        message: 'success',
        data: { mode: 'system', estimatedMinutes: 12 },
      },
    },
  })
  estimatedWait(@Query('orderId') orderId?: string) {
    return this.orderService.estimatedWait(orderId);
  }

  @Put('status')
  @ApiBearerAuth('JWT-auth')
  @ApiOkResponse({
    description: 'Update order status',
    schema: {
      example: {
        code: 200,
        message: 'success',
        data: { id: 'uuid', status: 'READY' },
      },
    },
  })
  updateStatus(@Body() dto: UpdateOrderStatusDto) {
    return this.orderService.updateStatus(dto);
  }

  @Post('request-payment')
  @Public()
  @HttpCode(200)
  @ApiOkResponse({
    description: 'Request payment success',
    schema: {
      example: {
        code: 200,
        message: 'success',
        data: { message: 'Đã gửi yêu cầu thanh toán' },
      },
    },
  })
  requestPayment(@Body() dto: RequestPaymentDto) {
    return this.orderService.requestPayment(dto);
  }

  @Post('pay')
  @Public()
  @HttpCode(200)
  @ApiOkResponse({
    description: 'Thanh toán một đơn theo orderId',
    schema: {
      example: {
        code: 200,
        message: 'success',
        data: {
          orderId: 'uuid',
          paidStatus: true,
          message: 'Đã ghi nhận thanh toán đơn hàng',
        },
      },
    },
  })
  paySingle(@Body() dto: PaySingleOrderDto) {
    return this.orderService.paySingleOrder(dto);
  }

  @Post('pay-all')
  @Public()
  @HttpCode(200)
  @ApiOkResponse({
    description: 'Thanh toán gộp tất cả đơn chưa trả tiền của bàn theo tableToken',
    schema: {
      example: {
        code: 200,
        message: 'success',
        data: {
          tableToken: 'token',
          paidOrderCount: 2,
          orderIds: ['uuid-1', 'uuid-2'],
          message: 'Đã ghi nhận thanh toán gộp theo bàn',
        },
      },
    },
  })
  payBulkByTable(@Body() dto: PayUnpaidOrdersByTableDto) {
    return this.orderService.payUnpaidOrdersByTable(dto);
  }

  @Post('checkout/preview')
  @Public()
  @HttpCode(200)
  @ApiOkResponse({
    description: 'Xem trước tổng tiền gộp các đơn mở của bàn',
    schema: {
      example: {
        code: 200,
        message: 'success',
        data: {
          tableId: 'uuid',
          tableName: 'Ban 01',
          tableToken: 'uuid-v4',
          orderIds: ['uuid', 'uuid'],
          totalAmount: 210000,
          orders: [],
        },
      },
    },
  })
  checkoutPreview(@Body() dto: CheckoutPreviewDto) {
    return this.orderService.checkoutPreview(dto);
  }

  @Post('checkout/start')
  @Public()
  @HttpCode(200)
  @ApiOkResponse({
    description:
      'Tạo phiên thanh toán gộp (một lần quét). Giữ clientSecret để gọi complete sau khi đã thu tiền.',
    schema: {
      example: {
        code: 200,
        message: 'success',
        data: {
          sessionId: 'uuid',
          clientSecret: 'hex',
          tableToken: 'uuid-v4',
          tableId: 'uuid',
          orderIds: ['uuid'],
          totalAmount: 210000,
          expiresAt: '2026-05-05T12:15:00.000Z',
          orders: [],
        },
      },
    },
  })
  checkoutStart(@Body() dto: CheckoutStartDto) {
    return this.orderService.checkoutStart(dto);
  }

  @Post('checkout/complete')
  @Public()
  @HttpCode(200)
  @ApiOkResponse({
    description:
      'Xác nhận đã thanh toán gộp (khách / callback sau cổng thanh toán). Cần đúng sessionId + tableToken + clientSecret.',
    schema: {
      example: {
        code: 200,
        message: 'success',
        data: {
          idempotent: false,
          sessionId: 'uuid',
          orderIds: ['uuid'],
          totalAmount: 210000,
          orders: [],
        },
      },
    },
  })
  checkoutComplete(@Body() dto: CheckoutCompleteDto) {
    return this.orderService.checkoutComplete(dto);
  }

  @Post('checkout/complete-staff')
  @ApiBearerAuth('JWT-auth')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  @HttpCode(200)
  @ApiOkResponse({
    description:
      'Thu ngân xác nhận đã thu tiền (không cần clientSecret). Dùng khi khách trả tiền mặt / POS nội bộ.',
    schema: {
      example: {
        code: 200,
        message: 'success',
        data: {
          idempotent: false,
          sessionId: 'uuid',
          orderIds: ['uuid'],
          totalAmount: 210000,
          orders: [],
        },
      },
    },
  })
  checkoutCompleteStaff(@Body() dto: CheckoutCompleteStaffDto) {
    return this.orderService.checkoutCompleteStaff(dto);
  }

  @Post('request-payment-batch')
  @Public()
  @HttpCode(200)
  @ApiOkResponse({
    description: 'Gửi yêu cầu thanh toán gộp (SSE payment_request_batch)',
    schema: {
      example: {
        code: 200,
        message: 'success',
        data: {
          message: 'Đã gửi yêu cầu thanh toán gộp',
          orderIds: ['uuid'],
          totalAmount: 210000,
        },
      },
    },
  })
  requestPaymentBatch(@Body() dto: CheckoutRequestBatchPaymentDto) {
    return this.orderService.requestPaymentBatch(dto);
  }

  @Get('stats/revenue')
  @ApiBearerAuth('JWT-auth')
  @Roles(UserRole.ADMIN)
  @ApiQuery({ name: 'period', required: false, enum: ['day', 'week', 'month'] })
  @ApiQuery({ name: 'from', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'to', required: false, description: 'YYYY-MM-DD' })
  @ApiOkResponse({
    description: 'Revenue stats',
    schema: {
      example: {
        code: 200,
        message: 'success',
        data: {
          totalRevenue: 1200000,
          totalOrders: 48,
          data: [{ date: '2026-05-05', revenue: 500000, orderCount: 20 }],
        },
      },
    },
  })
  statsRevenue(
    @Query('period') period?: 'day' | 'week' | 'month',
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.orderService.statsRevenue({ period, from, to });
  }

  @Get('stats/top-products')
  @ApiBearerAuth('JWT-auth')
  @Roles(UserRole.ADMIN)
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'from', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'to', required: false, description: 'YYYY-MM-DD' })
  @ApiOkResponse({
    description: 'Top products stats',
    schema: {
      example: {
        code: 200,
        message: 'success',
        data: [
          {
            productId: 'uuid',
            productName: 'Ca phe sua',
            totalQuantity: 120,
            totalRevenue: 3000000,
          },
        ],
      },
    },
  })
  statsTopProducts(
    @Query('limit') limit?: number,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.orderService.statsTopProducts({ limit: limit ? Number(limit) : 10, from, to });
  }
}
