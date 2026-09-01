import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOtpVerification1788228533982 implements MigrationInterface {
    name = 'AddOtpVerification1788228533982'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "email_verified_at" TIMESTAMP WITH TIME ZONE`);
        // Backfill: every account that existed before OTP verification was
        // introduced is treated as already verified so no current user is
        // locked out of login by the new gate in AuthService.login().
        await queryRunner.query(`UPDATE "users" SET "email_verified_at" = "created_at" WHERE "email_verified_at" IS NULL`);
        await queryRunner.query(`ALTER TABLE "users" ADD "token_version" integer NOT NULL DEFAULT '0'`);

        await queryRunner.query(`CREATE TYPE "public"."otp_verifications_purpose_enum" AS ENUM('REGISTRATION', 'PASSWORD_RESET')`);
        await queryRunner.query(`CREATE TABLE "otp_verifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "purpose" "public"."otp_verifications_purpose_enum" NOT NULL, "otp_hash" character varying NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "attempts" integer NOT NULL DEFAULT '0', "verified_at" TIMESTAMP WITH TIME ZONE, "consumed_at" TIMESTAMP WITH TIME ZONE, "reset_token_hash" character varying, "reset_token_expires_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_otp_verifications_id" PRIMARY KEY ("id"))`);

        // General lookup by account+purpose (issuing a new code, counting
        // recent ones for the hourly cap).
        await queryRunner.query(`CREATE INDEX "IDX_otp_verifications_user_purpose" ON "otp_verifications" ("user_id", "purpose")`);
        // Bounds how much dead data a full-table scan would ever need to
        // consider once cleanup tooling exists; not load-bearing today.
        await queryRunner.query(`CREATE INDEX "IDX_otp_verifications_expires_at" ON "otp_verifications" ("expires_at")`);
        // The hot path: "does an active (not consumed, not yet verified)
        // code exist for this account+purpose" — partial so rows that are
        // already done drop out of the index entirely.
        await queryRunner.query(`CREATE INDEX "IDX_otp_verifications_active" ON "otp_verifications" ("user_id", "purpose") WHERE "consumed_at" IS NULL AND "verified_at" IS NULL`);
        // Password-reset token redemption looks up by hash alone.
        await queryRunner.query(`CREATE INDEX "IDX_otp_verifications_reset_token_hash" ON "otp_verifications" ("reset_token_hash") WHERE "reset_token_hash" IS NOT NULL`);

        await queryRunner.query(`ALTER TABLE "otp_verifications" ADD CONSTRAINT "FK_otp_verifications_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "otp_verifications" DROP CONSTRAINT "FK_otp_verifications_user_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_otp_verifications_reset_token_hash"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_otp_verifications_active"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_otp_verifications_expires_at"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_otp_verifications_user_purpose"`);
        await queryRunner.query(`DROP TABLE "otp_verifications"`);
        await queryRunner.query(`DROP TYPE "public"."otp_verifications_purpose_enum"`);

        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "token_version"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "email_verified_at"`);
    }

}
