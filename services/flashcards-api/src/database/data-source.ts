import 'dotenv/config';
import { DataSource } from 'typeorm';
import { User } from '../modules/users/entities/user.entity.js';
import { FlashcardSet } from '../modules/flashcard-sets/entities/flashcard-set.entity.js';
import { Flashcard } from '../modules/flashcards/entities/flashcard.entity.js';
import { StudySession } from '../modules/study/entities/study-session.entity.js';
import { StudyProgress } from '../modules/progress/entities/study-progress.entity.js';
import { OtpVerification } from '../modules/otp/entities/otp-verification.entity.js';
import { LearningSession } from '../modules/learning/entities/learning-session.entity.js';
import { LearningCardState } from '../modules/learning/entities/learning-card-state.entity.js';

/**
 * Standalone DataSource used only by the TypeORM CLI (migration:generate /
 * migration:run / migration:revert). The running Nest app gets its
 * connection via TypeOrmModule.forRootAsync in app.module.ts instead.
 */
const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST ?? 'localhost',
  port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
  username: process.env.DATABASE_USERNAME ?? 'postgres',
  password: process.env.DATABASE_PASSWORD ?? 'postgres',
  database: process.env.DATABASE_NAME ?? 'flashcards',
  entities: [
    User,
    FlashcardSet,
    Flashcard,
    StudySession,
    StudyProgress,
    OtpVerification,
    LearningSession,
    LearningCardState,
  ],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
});

export default AppDataSource;
