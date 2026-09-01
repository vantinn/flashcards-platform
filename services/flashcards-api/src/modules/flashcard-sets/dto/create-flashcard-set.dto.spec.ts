import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, it, expect } from 'vitest';
import { CreateFlashcardSetDto } from './create-flashcard-set.dto.js';
import { SetLanguage } from '../entities/flashcard-set.entity.js';

async function validateDto(input: Record<string, unknown>) {
  const dto = plainToInstance(CreateFlashcardSetDto, { title: 'Sample', ...input });
  return validate(dto);
}

describe('CreateFlashcardSetDto — language', () => {
  it('accepts each valid language value', async () => {
    for (const language of Object.values(SetLanguage)) {
      const errors = await validateDto({ language });
      expect(errors).toHaveLength(0);
    }
  });

  it('accepts a missing language (optional field)', async () => {
    const errors = await validateDto({});
    expect(errors).toHaveLength(0);
  });

  it('rejects a value outside the enum', async () => {
    const errors = await validateDto({ language: 'spanish' });
    expect(errors.some((e) => e.property === 'language')).toBe(true);
  });

  it('rejects a Vietnamese display label mistakenly sent as the enum value', async () => {
    const errors = await validateDto({ language: 'Tiếng Anh' });
    expect(errors.some((e) => e.property === 'language')).toBe(true);
  });
});
