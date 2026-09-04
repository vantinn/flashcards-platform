import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);

  // Express's default JSON body limit (100kb) is comfortably enough for
  // every existing endpoint, but not for Bulk Add Flashcards: at the
  // existing 2000-char max per front/back field, a full MAX_BULK_FLASHCARDS
  // paste can approach ~2MB. DTO-level array/string length limits remain
  // the real validation boundary — this just stops a legitimate large
  // paste from being rejected before it ever reaches them.
  app.useBodyParser('json', { limit: '2mb' });

  // Sets the standard hardening headers (X-Content-Type-Options,
  // X-Frame-Options, a conservative CSP, etc.) that a JSON-only API has no
  // other reason to set itself. contentSecurityPolicy is left at helmet's
  // default rather than disabled — this API never serves HTML, so a
  // restrictive CSP costs nothing and only helps if it's ever proxied
  // behind something that does.
  app.use(helmet());

  app.use(cookieParser());

  app.enableCors({
    origin: configService.get<string>('app.webUrl'),
    credentials: true,
  });

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Not exposed in production — a full API schema (routes, DTOs, shapes)
  // is useful for local/staging development but is otherwise free
  // reconnaissance for an attacker with no offsetting benefit to real users.
  if (configService.get<string>('app.nodeEnv') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Flashcard Learning Platform API')
      .setDescription('REST API for flashcard sets, cards, study sessions and progress')
      .setVersion('1.0')
      .addCookieAuth('access_token')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = configService.get<number>('app.port') ?? 3001;
  await app.listen(port);
}
await bootstrap();
