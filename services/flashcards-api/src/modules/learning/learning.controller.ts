import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { LearningService } from './learning.service.js';
import { StartLearningSessionDto } from './dto/start-learning-session.dto.js';
import { SubmitAnswerDto } from './dto/submit-answer.dto.js';

@Controller('learning-sessions')
export class LearningController {
  constructor(private readonly learningService: LearningService) {}

  @Get()
  listForSet(@CurrentUser() user: AuthenticatedUser, @Query('setId', ParseUUIDPipe) setId: string) {
    return this.learningService.listForSet(user.id, setId);
  }

  @Post('start')
  start(@CurrentUser() user: AuthenticatedUser, @Body() dto: StartLearningSessionDto) {
    return this.learningService.start(user.id, dto.setId, dto.mode);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.learningService.getSession(id, user.id);
  }

  @Get(':id/question')
  currentQuestion(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.learningService.getCurrentQuestion(id, user.id);
  }

  @Post(':id/answer')
  answer(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubmitAnswerDto,
  ) {
    return this.learningService.answer(id, user.id, dto);
  }
}
