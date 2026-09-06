// SearchSetsDto extends PaginationQueryDto, whose page/limit fields use
// class-transformer's @Type(() => Number) — that decorator needs
// Reflect.getMetadata, normally polyfilled once by main.ts's `import
// 'reflect-metadata'` at app bootstrap. This spec instantiates the DTO
// directly, outside that bootstrap, so it needs the same polyfill itself.
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, it, expect } from 'vitest';
import { SearchSetsDto } from './search-sets.dto.js';
import { SetLanguage } from '../../flashcard-sets/entities/flashcard-set.entity.js';

async function validateDto(input: Record<string, unknown>) {
  const dto = plainToInstance(SearchSetsDto, input);
  return validate(dto);
}

describe('SearchSetsDto — category', () => {
  it('accepts each valid category value', async () => {
    for (const category of Object.values(SetLanguage)) {
      const errors = await validateDto({ category });
      expect(errors).toHaveLength(0);
    }
  });

  it('accepts a missing category (optional field — no category restriction)', async () => {
    const errors = await validateDto({});
    expect(errors).toHaveLength(0);
  });

  it('rejects a value outside the enum rather than silently treating it as "all"', async () => {
    const errors = await validateDto({ category: 'spanish' });
    expect(errors.some((e) => e.property === 'category')).toBe(true);
  });

  it('rejects a Vietnamese display label mistakenly sent as the enum value', async () => {
    const errors = await validateDto({ category: 'Tiếng Anh' });
    expect(errors.some((e) => e.property === 'category')).toBe(true);
  });
});

// The cap is what bounds Redis key cardinality and key size — every distinct
// term becomes its own cache entry, so an unbounded field here is an
// unbounded keyspace there. See SearchSetsDto.q.
describe('SearchSetsDto — q length cap', () => {
  it('accepts a term as long as the longest possible set title', async () => {
    const errors = await validateDto({ q: 'x'.repeat(200) });
    expect(errors).toHaveLength(0);
  });

  it('rejects a term longer than any title could match', async () => {
    const errors = await validateDto({ q: 'x'.repeat(201) });
    expect(errors.some((e) => e.property === 'q')).toBe(true);
  });

  it('still accepts an absent or empty term', async () => {
    expect(await validateDto({})).toHaveLength(0);
    expect(await validateDto({ q: '' })).toHaveLength(0);
  });
});
