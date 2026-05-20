import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPaidOrderStatus1736150500000 implements MigrationInterface {
  name = 'AddPaidOrderStatus1736150500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_type t
          WHERE t.typname = 'orders_status_enum'
        ) THEN
          ALTER TYPE "public"."orders_status_enum" ADD VALUE IF NOT EXISTS 'PAID';
        END IF;
        IF EXISTS (
          SELECT 1
          FROM pg_type t
          WHERE t.typname = 'order_status_enum'
        ) THEN
          ALTER TYPE "public"."order_status_enum" ADD VALUE IF NOT EXISTS 'PAID';
        END IF;
      END
      $$;
    `);
  }

  public async down(): Promise<void> {
    // PostgreSQL does not support removing enum values safely.
  }
}
