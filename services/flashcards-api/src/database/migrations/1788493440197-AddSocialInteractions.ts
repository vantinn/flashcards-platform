import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSocialInteractions1788493440197 implements MigrationInterface {
    name = 'AddSocialInteractions1788493440197'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "set_likes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid, "flashcard_set_id" uuid, CONSTRAINT "UQ_eced9bf4da0d68059e0d5241111" UNIQUE ("user_id", "flashcard_set_id"), CONSTRAINT "PK_3764f57d7b51fc11e8fa63c2db9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_52235e964d4f193813ce4e7069" ON "set_likes"  ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_ddcb445f235e6f57f6d3a50d0e" ON "set_likes"  ("flashcard_set_id") `);
        await queryRunner.query(`CREATE TABLE "comments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "content" text NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid, "flashcard_set_id" uuid, "parent_comment_id" uuid, CONSTRAINT "PK_8bf68bc960f2b69e818bdb90dcb" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_4c675567d2a58f0b07cef09c13" ON "comments"  ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_93ce08bdbea73c0c7ee673ec35" ON "comments"  ("parent_comment_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_5930ad1cd6d7ec457955745123" ON "comments"  ("flashcard_set_id", "created_at") `);
        await queryRunner.query(`ALTER TABLE "set_likes" ADD CONSTRAINT "FK_52235e964d4f193813ce4e7069c" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "set_likes" ADD CONSTRAINT "FK_ddcb445f235e6f57f6d3a50d0ec" FOREIGN KEY ("flashcard_set_id") REFERENCES "flashcard_sets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "comments" ADD CONSTRAINT "FK_4c675567d2a58f0b07cef09c13d" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "comments" ADD CONSTRAINT "FK_7fa27ba2a639983e93d3fb39b37" FOREIGN KEY ("flashcard_set_id") REFERENCES "flashcard_sets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "comments" ADD CONSTRAINT "FK_93ce08bdbea73c0c7ee673ec35a" FOREIGN KEY ("parent_comment_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "comments" DROP CONSTRAINT "FK_93ce08bdbea73c0c7ee673ec35a"`);
        await queryRunner.query(`ALTER TABLE "comments" DROP CONSTRAINT "FK_7fa27ba2a639983e93d3fb39b37"`);
        await queryRunner.query(`ALTER TABLE "comments" DROP CONSTRAINT "FK_4c675567d2a58f0b07cef09c13d"`);
        await queryRunner.query(`ALTER TABLE "set_likes" DROP CONSTRAINT "FK_ddcb445f235e6f57f6d3a50d0ec"`);
        await queryRunner.query(`ALTER TABLE "set_likes" DROP CONSTRAINT "FK_52235e964d4f193813ce4e7069c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5930ad1cd6d7ec457955745123"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_93ce08bdbea73c0c7ee673ec35"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4c675567d2a58f0b07cef09c13"`);
        await queryRunner.query(`DROP TABLE "comments"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ddcb445f235e6f57f6d3a50d0e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_52235e964d4f193813ce4e7069"`);
        await queryRunner.query(`DROP TABLE "set_likes"`);
    }

}
