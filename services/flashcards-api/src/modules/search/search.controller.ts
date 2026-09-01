import { Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service.js';
import { SearchSetsDto } from './dto/search-sets.dto.js';

// No @Public() here — "public sets" means visible to any signed-in user of
// the app, not anonymously browsable. The global JwtAuthGuard applies.
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  search(@Query() query: SearchSetsDto) {
    return this.searchService.searchPublicSets(query);
  }
}
