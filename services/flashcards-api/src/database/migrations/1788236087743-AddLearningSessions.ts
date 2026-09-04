import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLearningSessions1788236087743 implements MigrationInterface {
    name = 'AddLearningSessions1788236087743'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."learning_sessions_mode_enum" AS ENUM('cram', 'deep_learning')`);
        await queryRunner.query(`CREATE TYPE "public"."learning_sessions_status_enum" AS ENUM('in_progress', 'completed')`);
        await queryRunner.query(`CREATE TYPE "public"."learning_sessions_current_question_type_enum" AS ENUM('multiple_choice', 'typed_answer')`);
        await queryRunner.query(`CREATE TABLE "learning_sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "mode" "public"."learning_sessions_mode_enum" NOT NULL, "status" "public"."learning_sessions_status_enum" NOT NULL DEFAULT 'in_progress', "sequence" integer NOT NULL DEFAULT '0', "current_question_type" "public"."learning_sessions_current_question_type_enum", "current_choices" jsonb, "started_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "completed_at" TIMESTAMP WITH TIME ZONE, "last_activity_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid, "set_id" uuid, "current_card_id" uuid, CONSTRAINT "UQ_9deb4c89d34d407cb694da61d08" UNIQUE ("user_id", "set_id", "mode"), CONSTRAINT "PK_35638efbb9078de611aa9cc3ecd" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_cc362342ca274ef516059737a7" ON "learning_sessions"  ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_d905aab2ffdc985985949ef8e6" ON "learning_sessions"  ("set_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_52c5354a47e984925ec99da49d" ON "learning_sessions"  ("status") `);
        await queryRunner.query(`CREATE TABLE "learning_card_states" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "completed" boolean NOT NULL DEFAULT false, "attempts" integer NOT NULL DEFAULT '0', "correct_attempts" integer NOT NULL DEFAULT '0', "incorrect_attempts" integer NOT NULL DEFAULT '0', "due_sequence" integer NOT NULL DEFAULT '0', "mc_completed" boolean NOT NULL DEFAULT false, "typed_completed" boolean NOT NULL DEFAULT false, "repetitions" integer NOT NULL DEFAULT '0', "interval_days" integer NOT NULL DEFAULT '0', "last_reviewed_at" TIMESTAMP WITH TIME ZONE, "next_review_at" TIMESTAMP WITH TIME ZONE, "session_id" uuid, "flashcard_id" uuid, CONSTRAINT "UQ_daffbcfa8eca98120e4148e092a" UNIQUE ("session_id", "flashcard_id"), CONSTRAINT "PK_2362eb19375fa9ca0e4da493b2d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_f8ec95647c2d5199d150142881" ON "learning_card_states"  ("session_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_d4d4e0ee85884111d32c095e81" ON "learning_card_states"  ("completed") `);
        await queryRunner.query(`ALTER TABLE "learning_sessions" ADD CONSTRAINT "FK_cc362342ca274ef516059737a74" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "learning_sessions" ADD CONSTRAINT "FK_d905aab2ffdc985985949ef8e64" FOREIGN KEY ("set_id") REFERENCES "flashcard_sets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "learning_sessions" ADD CONSTRAINT "FK_5fa431312261b1ceabbbe726568" FOREIGN KEY ("current_card_id") REFERENCES "flashcards"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "learning_card_states" ADD CONSTRAINT "FK_f8ec95647c2d5199d1501428818" FOREIGN KEY ("session_id") REFERENCES "learning_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "learning_card_states" ADD CONSTRAINT "FK_fc5ea28519ab3415dcdd1afff32" FOREIGN KEY ("flashcard_id") REFERENCES "flashcards"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "learning_card_states" DROP CONSTRAINT "FK_fc5ea28519ab3415dcdd1afff32"`);
        await queryRunner.query(`ALTER TABLE "learning_card_states" DROP CONSTRAINT "FK_f8ec95647c2d5199d1501428818"`);
        await queryRunner.query(`ALTER TABLE "learning_sessions" DROP CONSTRAINT "FK_5fa431312261b1ceabbbe726568"`);
        await queryRunner.query(`ALTER TABLE "learning_sessions" DROP CONSTRAINT "FK_d905aab2ffdc985985949ef8e64"`);
        await queryRunner.query(`ALTER TABLE "learning_sessions" DROP CONSTRAINT "FK_cc362342ca274ef516059737a74"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d4d4e0ee85884111d32c095e81"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f8ec95647c2d5199d150142881"`);
        await queryRunner.query(`DROP TABLE "learning_card_states"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_52c5354a47e984925ec99da49d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d905aab2ffdc985985949ef8e6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cc362342ca274ef516059737a7"`);
        await queryRunner.query(`DROP TABLE "learning_sessions"`);
        await queryRunner.query(`DROP TYPE "public"."learning_sessions_current_question_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."learning_sessions_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."learning_sessions_mode_enum"`);
    }

}
