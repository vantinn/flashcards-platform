import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSpacedRepetitionFields1788167990654 implements MigrationInterface {
    name = 'AddSpacedRepetitionFields1788167990654'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "study_progress" ADD "repetitions" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "study_progress" ADD "interval_days" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`CREATE INDEX "IDX_7783cc3c5872ddc23a92c21e0f" ON "study_progress"  ("next_review_at") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_7783cc3c5872ddc23a92c21e0f"`);
        await queryRunner.query(`ALTER TABLE "study_progress" DROP COLUMN "interval_days"`);
        await queryRunner.query(`ALTER TABLE "study_progress" DROP COLUMN "repetitions"`);
    }

}
