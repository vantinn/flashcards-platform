import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserOnboarding1788469739555 implements MigrationInterface {
    name = 'AddUserOnboarding1788469739555'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."users_gender_enum" AS ENUM('male', 'female')`);
        await queryRunner.query(`ALTER TABLE "users" ADD "gender" "public"."users_gender_enum"`);
        await queryRunner.query(`ALTER TABLE "users" ADD "onboarding_completed_at" TIMESTAMP WITH TIME ZONE`);
        // Accounts that already existed before this migration predate the
        // onboarding feature entirely — treat them as already onboarded
        // (backfilled from their own createdAt) so they are never forced
        // through the new flow on their next login. Only rows inserted after
        // this point (i.e. genuinely new signups) get onboarding_completed_at
        // = NULL from here on, which is what actually requires them to
        // complete onboarding — see User.onboardingCompletedAt.
        await queryRunner.query(`UPDATE "users" SET "onboarding_completed_at" = "created_at" WHERE "onboarding_completed_at" IS NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "onboarding_completed_at"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "gender"`);
        await queryRunner.query(`DROP TYPE "public"."users_gender_enum"`);
    }

}
