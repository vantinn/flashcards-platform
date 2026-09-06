import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // These specs share one PostgreSQL database and one Redis instance, and
    // search-cache invalidation is deliberately coarse (every flashcard-set
    // mutation clears the whole `search:` prefix). Run in parallel, a set
    // created by one file wipes the cache another file is mid-assertion on.
    // Serialising the files is what makes shared-state assertions
    // deterministic; the unit suite (vitest.config.ts) still runs in parallel.
    fileParallelism: false,
  },
});
