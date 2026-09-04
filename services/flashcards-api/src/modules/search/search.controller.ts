import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { SearchService } from './search.service.js';
import { SearchSetsDto } from './dto/search-sets.dto.js';

// No @Public() here — "public sets" means visible to any signed-in user of
// the app, not anonymously browsable. The global JwtAuthGuard applies.
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  search(@Query() query: SearchSetsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.searchService.searchPublicSets(query, user.id);
  }
}
