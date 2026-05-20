import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrderPaidStatus1736150600000 implements MigrationInterface {
  name = 'AddOrderPaidStatus1736150600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "paidStatus" boolean NOT NULL DEFAULT false`,
    );

    await queryRunner.query(`
      UPDATE "orders"
      SET "paidStatus" = true
      WHERE "status" = 'PAID'
    `);

    await queryRunner.query(`
      UPDATE "orders"
      SET "status" = 'COMPLETED'
      WHERE "status" = 'PAID'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "orders"
      SET "status" = 'PAID'
      WHERE "paidStatus" = true AND "status" = 'COMPLETED'
    `);

    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "paidStatus"`);
  }
}
