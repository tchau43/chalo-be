import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import {
  PAGINATION_DEFAULT_PAGE_SIZE,
  PAGINATION_MAX_PAGE_SIZE,
} from '../constants';

export class PaginationQueryDto {
  @ApiPropertyOptional({ example: 1, minimum: 1, default: 1 })
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? 1 : Number(value)))
  @IsInt()
  @Min(1)
  pageNo: number = 1;

  @ApiPropertyOptional({
    example: PAGINATION_DEFAULT_PAGE_SIZE,
    minimum: 1,
    maximum: PAGINATION_MAX_PAGE_SIZE,
    default: PAGINATION_DEFAULT_PAGE_SIZE,
  })
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined ? PAGINATION_DEFAULT_PAGE_SIZE : Number(value),
  )
  @IsInt()
  @Min(1)
  @Max(PAGINATION_MAX_PAGE_SIZE)
  pageSize: number = PAGINATION_DEFAULT_PAGE_SIZE;

  get skip(): number {
    return (this.pageNo - 1) * this.pageSize;
  }
}
