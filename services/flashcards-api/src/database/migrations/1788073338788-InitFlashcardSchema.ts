import { MigrationInterface, QueryRunner } from "typeorm";

export class InitFlashcardSchema1788073338788 implements MigrationInterface {
    name = 'InitFlashcardSchema1788073338788'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        await queryRunner.query(`CREATE TABLE "flashcards" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "front" text NOT NULL, "back" text NOT NULL, "front_image_url" text, "back_image_url" text, "position" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "set_id" uuid, CONSTRAINT "PK_9acf891ec7aaa7ca05c264ea94d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_3af6089335daaf47eabc3630ba" ON "flashcards"  ("set_id") `);
        await queryRunner.query(`CREATE TYPE "public"."flashcard_sets_visibility_enum" AS ENUM('private', 'unlisted', 'public')`);
        await queryRunner.query(`CREATE TABLE "flashcard_sets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying NOT NULL, "description" text, "cover_image_url" text, "category" character varying(100), "visibility" "public"."flashcard_sets_visibility_enum" NOT NULL DEFAULT 'private', "card_count" integer NOT NULL DEFAULT '0', "study_count" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "creator_id" uuid, CONSTRAINT "PK_70634f8cbb06202765aac894048" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_a1d73e15628eb6116dd26137b7" ON "flashcard_sets"  ("creator_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_5b4c6647743839f2a639ddd07e" ON "flashcard_sets"  ("visibility") `);
        await queryRunner.query(`CREATE TYPE "public"."study_sessions_mode_enum" AS ENUM('flashcard')`);
        await queryRunner.query(`CREATE TABLE "study_sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "mode" "public"."study_sessions_mode_enum" NOT NULL DEFAULT 'flashcard', "started_at" TIMESTAMP NOT NULL DEFAULT now(), "completed_at" TIMESTAMP WITH TIME ZONE, "cards_studied" integer NOT NULL DEFAULT '0', "correct_count" integer NOT NULL DEFAULT '0', "incorrect_count" integer NOT NULL DEFAULT '0', "user_id" uuid, "set_id" uuid, CONSTRAINT "PK_529b2be328c0a953f9bf0cf988e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_5ea09953d6fd1462a931a596e2" ON "study_sessions"  ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_fea670a8639b748e7aec667ad9" ON "study_sessions"  ("set_id") `);
        await queryRunner.query(`CREATE TYPE "public"."study_progress_status_enum" AS ENUM('new', 'learning', 'mastered')`);
        await queryRunner.query(`CREATE TABLE "study_progress" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "status" "public"."study_progress_status_enum" NOT NULL DEFAULT 'new', "correct_count" integer NOT NULL DEFAULT '0', "incorrect_count" integer NOT NULL DEFAULT '0', "last_reviewed_at" TIMESTAMP WITH TIME ZONE, "next_review_at" TIMESTAMP WITH TIME ZONE, "user_id" uuid, "flashcard_id" uuid, CONSTRAINT "UQ_4920a1ceb08c10b510aaa23b0a3" UNIQUE ("user_id", "flashcard_id"), CONSTRAINT "PK_3d6167d8e0a08a5c26a516e0d37" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_b89bb9c402db026650d317e497" ON "study_progress"  ("user_id") `);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "password_hash" character varying, "display_name" character varying NOT NULL, "avatar_url" text, "google_id" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "UQ_0bd5012aeb82628e07f6a1be53b" UNIQUE ("google_id"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "flashcards" ADD CONSTRAINT "FK_3af6089335daaf47eabc3630baa" FOREIGN KEY ("set_id") REFERENCES "flashcard_sets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "flashcard_sets" ADD CONSTRAINT "FK_a1d73e15628eb6116dd26137b79" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "study_sessions" ADD CONSTRAINT "FK_5ea09953d6fd1462a931a596e23" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "study_sessions" ADD CONSTRAINT "FK_fea670a8639b748e7aec667ad97" FOREIGN KEY ("set_id") REFERENCES "flashcard_sets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "study_progress" ADD CONSTRAINT "FK_b89bb9c402db026650d317e497d" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "study_progress" ADD CONSTRAINT "FK_2290a0471816eb7bcab3aed1917" FOREIGN KEY ("flashcard_id") REFERENCES "flashcards"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "study_progress" DROP CONSTRAINT "FK_2290a0471816eb7bcab3aed1917"`);
        await queryRunner.query(`ALTER TABLE "study_progress" DROP CONSTRAINT "FK_b89bb9c402db026650d317e497d"`);
        await queryRunner.query(`ALTER TABLE "study_sessions" DROP CONSTRAINT "FK_fea670a8639b748e7aec667ad97"`);
        await queryRunner.query(`ALTER TABLE "study_sessions" DROP CONSTRAINT "FK_5ea09953d6fd1462a931a596e23"`);
        await queryRunner.query(`ALTER TABLE "flashcard_sets" DROP CONSTRAINT "FK_a1d73e15628eb6116dd26137b79"`);
        await queryRunner.query(`ALTER TABLE "flashcards" DROP CONSTRAINT "FK_3af6089335daaf47eabc3630baa"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b89bb9c402db026650d317e497"`);
        await queryRunner.query(`DROP TABLE "study_progress"`);
        await queryRunner.query(`DROP TYPE "public"."study_progress_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fea670a8639b748e7aec667ad9"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5ea09953d6fd1462a931a596e2"`);
        await queryRunner.query(`DROP TABLE "study_sessions"`);
        await queryRunner.query(`DROP TYPE "public"."study_sessions_mode_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5b4c6647743839f2a639ddd07e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a1d73e15628eb6116dd26137b7"`);
        await queryRunner.query(`DROP TABLE "flashcard_sets"`);
        await queryRunner.query(`DROP TYPE "public"."flashcard_sets_visibility_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3af6089335daaf47eabc3630ba"`);
        await queryRunner.query(`DROP TABLE "flashcards"`);
    }

}
