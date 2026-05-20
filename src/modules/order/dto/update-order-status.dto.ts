import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsEnum, IsString } from 'class-validator';
import { OrderStatus } from '../../../common/enums/order-status.enum';

export class UpdateOrderStatusDto {
  @ApiProperty({ example: 'uuid' })
  @IsUUID()
  id: string;

  @ApiProperty({ enum: OrderStatus })
  @IsEnum(OrderStatus)
  status: OrderStatus;
}

export class RequestPaymentDto {
  @ApiProperty({ example: 'uuid' })
  @IsUUID()
  orderId: string;
}

export class PaySingleOrderDto {
  @ApiProperty({ example: 'uuid' })
  @IsUUID()
  orderId: string;
}

export class PayUnpaidOrdersByTableDto {
  @ApiProperty({ description: 'qrToken của bàn' })
  @IsString()
  tableToken: string;
}
