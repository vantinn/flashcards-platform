import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheService } from './cache.service.js';

/**
 * Global so any module can inject CacheService without importing this one
 * directly — same rationale as ConfigModule being global. There's exactly
 * one Redis connection for the whole process either way.
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [CacheService],
  exports: [CacheService],
})
export class RedisModule {}
