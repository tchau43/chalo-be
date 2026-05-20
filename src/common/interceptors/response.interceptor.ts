import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Response } from 'express';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, unknown> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const httpCtx = context.switchToHttp();
    const response = httpCtx.getResponse<Response>();

    return next.handle().pipe(
      map((data) => {
        // NestJS đã set statusCode (mặc định 201 cho POST, 200 cho GET/PUT/DELETE,
        // hoặc giá trị từ @HttpCode()). Đọc lại thay vì tự ý quyết định.
        const code = response.statusCode || 200;
        return {
          code,
          message: 'success',
          data: data ?? null,
        };
      }),
    );
  }
}
