import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * `@CreateDateColumn()`/`@UpdateDateColumn()` default to a timezone-naive
 * Postgres `timestamp` unless told otherwise. node-postgres then parses
 * that naive value back as local server time (not UTC), so on any server
 * not itself running in UTC every createdAt/updatedAt/startedAt comes back
 * shifted by the server's UTC offset — e.g. a session started seconds ago
 * rendering as "7h ago" on a UTC+7 host.
 *
 * The DB session's own timezone is UTC (confirmed via `SHOW timezone`), so
 * every naive value already on disk is a correct UTC wall-clock reading —
 * `AT TIME ZONE 'UTC'` here just reinterprets it as such while converting
 * the column, rather than the data-destroying drop+recreate TypeORM's
 * auto-generator produced for this diff.
 */
export class FixTimestampTimezones1788077346158 implements MigrationInterface {
    name = 'FixTimestampTimezones1788077346158'

    private readonly columns: [table: string, column: string][] = [
        ['users', 'created_at'],
        ['users', 'updated_at'],
        ['flashcard_sets', 'created_at'],
        ['flashcard_sets', 'updated_at'],
        ['flashcards', 'created_at'],
        ['flashcards', 'updated_at'],
        ['study_sessions', 'started_at'],
    ];

    public async up(queryRunner: QueryRunner): Promise<void> {
        for (const [table, column] of this.columns) {
            await queryRunner.query(
                `ALTER TABLE "${table}" ALTER COLUMN "${column}" TYPE TIMESTAMP WITH TIME ZONE USING "${column}" AT TIME ZONE 'UTC'`,
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        for (const [table, column] of this.columns) {
            await queryRunner.query(
                `ALTER TABLE "${table}" ALTER COLUMN "${column}" TYPE TIMESTAMP USING "${column}" AT TIME ZONE 'UTC'`,
            );
        }
    }
}
