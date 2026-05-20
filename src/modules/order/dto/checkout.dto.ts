import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ArrayMinSize,
} from 'class-validator';

export class CheckoutPreviewDto {
  @ApiProperty({ description: 'qrToken của bàn (cùng giá trị khi tạo đơn)' })
  @IsString()
  tableToken: string;

  @ApiPropertyOptional({
    description:
      'Nếu có: chỉ tính các đơn này. Nếu không: tất cả đơn chưa kết thúc của bàn.',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  orderIds?: string[];
}

export class CheckoutStartDto extends CheckoutPreviewDto {
  @ApiPropertyOptional({
    description: 'Thời gian sống phiên (phút), mặc định 15',
    default: 15,
    minimum: 5,
    maximum: 120,
  })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(120)
  ttlMinutes?: number;
}

export class CheckoutCompleteDto {
  @ApiProperty()
  @IsUUID()
  sessionId: string;

  @ApiProperty()
  @IsString()
  tableToken: string;

  @ApiProperty({ description: 'clientSecret trả về từ POST /order/checkout/start' })
  @IsString()
  clientSecret: string;
}

export class CheckoutCompleteStaffDto {
  @ApiProperty()
  @IsUUID()
  sessionId: string;
}

export class CheckoutRequestBatchPaymentDto {
  @ApiProperty()
  @IsString()
  tableToken: string;

  @ApiProperty({ type: [String], description: 'Danh sách orderId cần gộp yêu cầu thanh toán' })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  orderIds: string[];
}
