import { Controller, Get, Query } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator.js';
import { SearchService } from './search.service.js';
import { SearchSetsDto } from './dto/search-sets.dto.js';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Public()
  @Get()
  search(@Query() query: SearchSetsDto) {
    return this.searchService.searchPublicSets(query);
  }
}
