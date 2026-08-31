import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCategoryIndex1788169370139 implements MigrationInterface {
    name = 'AddCategoryIndex1788169370139'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX "IDX_d1169b7abc454723298a819c77" ON "flashcard_sets"  ("category") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_d1169b7abc454723298a819c77"`);
    }

}
