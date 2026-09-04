import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFlashcardSetLanguage1788240302107 implements MigrationInterface {
    name = 'AddFlashcardSetLanguage1788240302107'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."flashcard_sets_language_enum" AS ENUM('english', 'chinese', 'free')`);
        await queryRunner.query(`ALTER TABLE "flashcard_sets" ADD "language" "public"."flashcard_sets_language_enum" NOT NULL DEFAULT 'free'`);
        await queryRunner.query(`CREATE INDEX "IDX_efa90c51bb9693c46b19819e67" ON "flashcard_sets"  ("language") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_efa90c51bb9693c46b19819e67"`);
        await queryRunner.query(`ALTER TABLE "flashcard_sets" DROP COLUMN "language"`);
        await queryRunner.query(`DROP TYPE "public"."flashcard_sets_language_enum"`);
    }

}
