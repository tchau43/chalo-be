import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    const { method, originalUrl, ip } = req;

    res.on('finish', () => {
      const duration = Date.now() - start;
      const { statusCode } = res;
      const len = res.get('content-length') ?? '-';
      const userAgent = req.get('user-agent') ?? '-';

      const log = `${method} ${originalUrl} ${statusCode} ${len}b ${duration}ms - ${ip} "${userAgent}"`;

      if (statusCode >= 500) this.logger.error(log);
      else if (statusCode >= 400) this.logger.warn(log);
      else this.logger.log(log);
    });

    next();
  }
}
