import { ClassSerializerInterceptor, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import appConfig from './config/app.config.js';
import databaseConfig from './config/database.config.js';
import authConfig from './config/auth.config.js';
import redisConfig from './config/redis.config.js';
import mailConfig from './config/mail.config.js';
import otpConfig from './config/otp.config.js';
import { RedisModule } from './redis/redis.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { TransformInterceptor } from './common/interceptors/transform.interceptor.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { User } from './modules/users/entities/user.entity.js';
import { FlashcardSet } from './modules/flashcard-sets/entities/flashcard-set.entity.js';
import { Flashcard } from './modules/flashcards/entities/flashcard.entity.js';
import { StudySession } from './modules/study/entities/study-session.entity.js';
import { StudyProgress } from './modules/progress/entities/study-progress.entity.js';
import { OtpVerification } from './modules/otp/entities/otp-verification.entity.js';
import { LearningSession } from './modules/learning/entities/learning-session.entity.js';
import { LearningCardState } from './modules/learning/entities/learning-card-state.entity.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { FlashcardSetsModule } from './modules/flashcard-sets/flashcard-sets.module.js';
import { FlashcardsModule } from './modules/flashcards/flashcards.module.js';
import { StudyModule } from './modules/study/study.module.js';
import { ProgressModule } from './modules/progress/progress.module.js';
import { LearningModule } from './modules/learning/learning.module.js';
import { SearchModule } from './modules/search/search.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, authConfig, redisConfig, mailConfig, otpConfig],
    }),
    RedisModule,
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('database.host'),
        port: config.get<number>('database.port'),
        username: config.get<string>('database.username'),
        password: config.get<string>('database.password'),
        database: config.get<string>('database.name'),
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
        // Schema changes only ever happen through reviewed TypeORM
        // migrations (see src/database) — never via drift-prone auto-sync.
        synchronize: false,
      }),
    }),
    AuthModule,
    UsersModule,
    FlashcardSetsModule,
    FlashcardsModule,
    StudyModule,
    ProgressModule,
    LearningModule,
    SearchModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Order matters: ClassSerializerInterceptor (strips @Exclude()'d fields,
    // e.g. User.passwordHash) must run on the raw entity before
    // TransformInterceptor wraps it in { data }. Nest runs interceptors
    // closest-to-the-controller first on the way out, so it's listed last.
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_INTERCEPTOR, useClass: ClassSerializerInterceptor },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
