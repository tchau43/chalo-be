import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const getTypeOrmConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => {
  const isDev = configService.get<string>('NODE_ENV') === 'development';
  const isProd = configService.get<string>('NODE_ENV') === 'production';
  // synchronize chỉ bật trên dev; production phải dùng migrations.
  const requestedSync =
    configService.get<string>('DB_SYNCHRONIZE', 'false') === 'true';
  const synchronize = isProd ? false : requestedSync;

  return {
    type: 'postgres',
    host: configService.get<string>('DB_HOST'),
    port: configService.get<number>('DB_PORT'),
    username: configService.get<string>('DB_USERNAME'),
    password: configService.get<string>('DB_PASSWORD'),
    database: configService.get<string>('DB_DATABASE'),
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/../migrations/*{.ts,.js}'],
    synchronize,
    // Trên production: tự động chạy migrations khi start.
    migrationsRun: isProd,
    logging: isDev,
  };
};
