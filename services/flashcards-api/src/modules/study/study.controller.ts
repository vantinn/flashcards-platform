import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { StudyService } from './study.service.js';
import { StartStudySessionDto } from './dto/start-study-session.dto.js';
import { CompleteStudySessionDto } from './dto/complete-study-session.dto.js';
import { HistoryQueryDto } from './dto/history-query.dto.js';

@Controller('study-sessions')
export class StudyController {
  constructor(private readonly studyService: StudyService) {}

  @Get()
  history(@CurrentUser() user: AuthenticatedUser, @Query() query: HistoryQueryDto) {
    return this.studyService.findHistoryForUser(user.id, query.limit);
  }

  // Declared before `:id` — a literal path segment must come first or
  // Nest would try to resolve "stats" as a (non-UUID) session id instead.
  @Get('stats')
  stats(@CurrentUser() user: AuthenticatedUser) {
    return this.studyService.getStats(user.id);
  }

  @Post()
  start(@CurrentUser() user: AuthenticatedUser, @Body() dto: StartStudySessionDto) {
    return this.studyService.start(user.id, dto.setId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.studyService.findOneForUser(id, user.id);
  }

  @Post(':id/complete')
  complete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CompleteStudySessionDto,
  ) {
    return this.studyService.complete(id, user.id, dto);
  }
}
