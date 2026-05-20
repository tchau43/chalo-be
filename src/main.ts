import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, BadRequestException, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { json, urlencoded } from 'express';
import { join } from 'path';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { assertProductionSecrets } from './config/env.validation';
import { HTTP_BODY_LIMIT } from './common/constants';

async function bootstrap() {
  // Validate production secrets BEFORE bootstrap NestJS
  assertProductionSecrets(process.env);

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  app.setGlobalPrefix('api');

  // Trust proxy (cần cho throttle/logger lấy đúng IP khi sau Nginx/Cloudflare)
  app.set('trust proxy', 1);

  // Body size limits
  app.use(json({ limit: HTTP_BODY_LIMIT }));
  app.use(urlencoded({ limit: HTTP_BODY_LIMIT, extended: true }));

  app.use(helmet());

  const corsOrigins = configService
    .get<string>('CORS_ORIGIN', 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim());
  app.enableCors({
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Cache-Control',
      'Pragma',
      'X-Requested-With',
    ],
    credentials: true,
  });

  app.useStaticAssets(join(__dirname, '..', 'uploads'), { prefix: '/uploads' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      exceptionFactory: (errors) => {
        const msg = errors
          .map((e) => Object.values(e.constraints || {}).join(', '))
          .join('; ');
        return new BadRequestException(msg);
      },
    }),
  );

  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  // Graceful shutdown — flush DB connections, close server cleanly on SIGTERM/SIGINT
  app.enableShutdownHooks();

  const isProduction = configService.get<string>('NODE_ENV') === 'production';

  if (!isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Chalo Coffee API')
      .setVersion('1.0')
      .setDescription('Backend API for Chalo Coffee Management System')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'JWT-auth',
      )
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = Number(configService.get('PORT') ?? 8080);
  const baseUrl = (
    configService.get<string>('APP_URL') ?? `http://localhost:${port}`
  ).replace(/\/$/, '');

  await app.listen(port);

  const envLabel = isProduction ? 'production' : 'development';
  const line = '─'.repeat(56);
  logger.log(`Application listening on port ${port} [${envLabel}]`);
  logger.log(line);
  logger.log(`  Web (base)     ${baseUrl}`);
  logger.log(`  API            ${baseUrl}/api`);
  logger.log(`  Health         ${baseUrl}/api/health`);
  if (!isProduction) {
    logger.log(`  Swagger        ${baseUrl}/api/docs`);
  }
  logger.log(`  Static uploads ${baseUrl}/uploads`);
  logger.log(line);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to bootstrap application:', err);
  process.exit(1);
});
