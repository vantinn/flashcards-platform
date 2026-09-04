// BulkCreateFlashcardsDto's `cards` field uses class-transformer's
// @Type(() => BulkFlashcardItemDto) — that decorator needs
// Reflect.getMetadata, normally polyfilled once by main.ts's `import
// 'reflect-metadata'` at app bootstrap. This spec instantiates the DTO
// directly, outside that bootstrap, so it needs the same polyfill itself.
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, it, expect } from 'vitest';
import { BulkCreateFlashcardsDto } from './bulk-create-flashcards.dto.js';

async function validateDto(cards: unknown) {
  const dto = plainToInstance(BulkCreateFlashcardsDto, { cards });
  return validate(dto);
}

describe('BulkCreateFlashcardsDto', () => {
  it('accepts a well-formed array of cards', async () => {
    const errors = await validateDto([
      { front: 'hello', back: 'xin chào' },
      { front: 'world', back: 'thế giới' },
    ]);
    expect(errors).toHaveLength(0);
  });

  it('rejects an empty array', async () => {
    const errors = await validateDto([]);
    expect(errors.some((e) => e.property === 'cards')).toBe(true);
  });

  it('rejects a missing cards field entirely', async () => {
    const dto = plainToInstance(BulkCreateFlashcardsDto, {});
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'cards')).toBe(true);
  });

  it('rejects a payload over the DTO-level hard ceiling (1000)', async () => {
    const cards = Array.from({ length: 1001 }, () => ({ front: 'a', back: 'b' }));
    const errors = await validateDto(cards);
    expect(errors.some((e) => e.property === 'cards')).toBe(true);
  });

  // These prove @ValidateNested + @Type actually validate each item's own
  // rules — a genuine risk with nested-array DTOs (omitting @Type silently
  // skips per-item validation entirely, so this is worth pinning down).
  it('rejects a row missing front', async () => {
    const errors = await validateDto([{ back: 'xin chào' }]);
    expect(errors.some((e) => e.property === 'cards')).toBe(true);
  });

  it('rejects a row missing back', async () => {
    const errors = await validateDto([{ front: 'hello' }]);
    expect(errors.some((e) => e.property === 'cards')).toBe(true);
  });

  it('rejects a row with an empty-string front', async () => {
    const errors = await validateDto([{ front: '', back: 'xin chào' }]);
    expect(errors.some((e) => e.property === 'cards')).toBe(true);
  });

  it('rejects a row whose front exceeds the 2000-character limit (same rule as manual card creation)', async () => {
    const errors = await validateDto([{ front: 'a'.repeat(2001), back: 'b' }]);
    expect(errors.some((e) => e.property === 'cards')).toBe(true);
  });

  it('rejects a row with a non-string front', async () => {
    const errors = await validateDto([{ front: 123, back: 'xin chào' }]);
    expect(errors.some((e) => e.property === 'cards')).toBe(true);
  });
});
