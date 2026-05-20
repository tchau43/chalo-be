import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, unknown>;
        message =
          typeof resObj['message'] === 'string'
            ? resObj['message']
            : Array.isArray(resObj['message'])
              ? (resObj['message'] as string[]).join('; ')
              : message;
      }
    } else if (exception instanceof Error) {
      // Không expose raw error (TypeORM, DB constraint, stack trace) ra client.
      // Chỉ log nội bộ để debug.
      this.logger.error(
        `Unhandled error: ${exception.message}`,
        exception.stack,
      );
      message = 'Internal server error';
    } else {
      this.logger.error(`Unknown exception thrown: ${JSON.stringify(exception)}`);
    }

    response.status(status).json({
      code: status,
      message,
      data: null,
    });
  }
}
