import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { ProgressService } from './progress.service.js';

@Controller('progress')
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Get('me')
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.progressService.findAllForUser(user.id);
  }

  @Get('summary')
  summary(@CurrentUser() user: AuthenticatedUser) {
    return this.progressService.getDashboardSummary(user.id);
  }
}
