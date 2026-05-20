/**
 * TypeORM DataSource cho CLI (migration:generate / migration:run / migration:revert).
 * KHÔNG dùng cho runtime — runtime đã có TypeOrmModule.forRootAsync trong AppModule.
 *
 * Sử dụng:
 *   npm run migration:generate -- src/migrations/AddSomething
 *   npm run migration:run
 *   npm run migration:revert
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  entities: [__dirname + '/**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
  logging: true,
});
