import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCheckoutSessions1736150400000 implements MigrationInterface {
  name = 'AddCheckoutSessions1736150400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."checkout_sessions_status_enum" AS ENUM('PENDING', 'COMPLETED', 'CANCELLED')`,
    );
    await queryRunner.query(`
      CREATE TABLE "checkout_sessions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tableToken" character varying(255) NOT NULL,
        "tableId" uuid NOT NULL,
        "orderIds" json NOT NULL,
        "totalAmount" integer NOT NULL,
        "status" "public"."checkout_sessions_status_enum" NOT NULL DEFAULT 'PENDING',
        "clientSecret" character varying(64) NOT NULL,
        "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_checkout_sessions" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_checkout_sessions_table_token" ON "checkout_sessions" ("tableToken")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_checkout_sessions_expires_at" ON "checkout_sessions" ("expiresAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_checkout_sessions_expires_at"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_checkout_sessions_table_token"`);
    await queryRunner.query(`DROP TABLE "checkout_sessions"`);
    await queryRunner.query(`DROP TYPE "public"."checkout_sessions_status_enum"`);
  }
}
