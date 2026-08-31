import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import AppDataSource from './data-source.js';
import { User } from '../modules/users/entities/user.entity.js';
import { FlashcardSet, SetVisibility } from '../modules/flashcard-sets/entities/flashcard-set.entity.js';
import { Flashcard } from '../modules/flashcards/entities/flashcard.entity.js';

// Local development seed data only — never run against a production
// database, and never put real credentials here (this password is a
// throwaway dev-only value, printed below rather than hidden, on purpose).
const DEV_USER_EMAIL = 'dev@example.com';
const DEV_USER_PASSWORD = 'password123';

async function seed() {
  const dataSource = await AppDataSource.initialize();

  const users = dataSource.getRepository(User);
  const sets = dataSource.getRepository(FlashcardSet);
  const cards = dataSource.getRepository(Flashcard);

  let devUser = await users.findOneBy({ email: DEV_USER_EMAIL });
  if (!devUser) {
    devUser = await users.save(
      users.create({
        email: DEV_USER_EMAIL,
        displayName: 'Dev User',
        passwordHash: await bcrypt.hash(DEV_USER_PASSWORD, 12),
      }),
    );
    console.log(`Created dev user: ${DEV_USER_EMAIL} / ${DEV_USER_PASSWORD}`);
  } else {
    console.log(`Dev user already exists: ${DEV_USER_EMAIL}`);
  }

  const existingSets = await sets.count({ where: { creator: { id: devUser.id } } });
  if (existingSets > 0) {
    console.log('Dev user already has flashcard sets — skipping sample data.');
    await dataSource.destroy();
    return;
  }

  const sampleSets: { title: string; description: string; visibility: SetVisibility; category: string; cards: [string, string][] }[] = [
    {
      title: 'Spanish Basics',
      description: 'Common greetings and everyday phrases.',
      visibility: SetVisibility.PUBLIC,
      category: 'Languages',
      cards: [
        ['Hola', 'Hello'],
        ['Gracias', 'Thank you'],
        ['Buenos días', 'Good morning'],
        ['Por favor', 'Please'],
      ],
    },
    {
      title: 'World Capitals',
      description: 'Capital cities of well-known countries.',
      visibility: SetVisibility.PUBLIC,
      category: 'Geography',
      cards: [
        ['France', 'Paris'],
        ['Japan', 'Tokyo'],
        ['Vietnam', 'Hanoi'],
        ['Brazil', 'Brasília'],
      ],
    },
    {
      title: 'Personal Notes',
      description: 'Private scratch set for testing.',
      visibility: SetVisibility.PRIVATE,
      category: 'Misc',
      cards: [['Test front', 'Test back']],
    },
  ];

  for (const sample of sampleSets) {
    const set = await sets.save(
      sets.create({
        title: sample.title,
        description: sample.description,
        visibility: sample.visibility,
        category: sample.category,
        creator: devUser,
        cardCount: sample.cards.length,
      }),
    );

    await cards.save(
      sample.cards.map(([front, back], position) =>
        cards.create({ set, front, back, position }),
      ),
    );

    console.log(`Created set "${set.title}" with ${sample.cards.length} cards.`);
  }

  await dataSource.destroy();
  console.log('Seed complete.');
}

seed().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
