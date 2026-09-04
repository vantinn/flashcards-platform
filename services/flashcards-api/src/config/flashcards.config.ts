import { registerAs } from '@nestjs/config';

export default registerAs('flashcards', () => ({
  // Bulk-add-by-paste ceiling (see FlashcardsService.bulkCreate) — protects
  // the server from an unbounded paste. A DTO-level @ArrayMaxSize backstops
  // this with a fixed hard ceiling before the request even reaches the
  // service, since a class-validator decorator can't read this at runtime.
  maxBulkImport: parseInt(process.env.MAX_BULK_FLASHCARDS ?? '500', 10),
}));
