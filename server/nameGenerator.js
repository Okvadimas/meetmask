const ADJECTIVES = [
  'Swift', 'Silent', 'Mystic', 'Crimson', 'Shadow', 'Neon', 'Cosmic', 'Frost',
  'Velvet', 'Iron', 'Crystal', 'Storm', 'Ember', 'Golden', 'Silver', 'Azure',
  'Scarlet', 'Jade', 'Onyx', 'Lunar', 'Solar', 'Phantom', 'Royal', 'Rogue',
  'Wild', 'Dark', 'Bright', 'Rapid', 'Noble', 'Brave', 'Clever', 'Fierce',
  'Gentle', 'Hidden', 'Ivory', 'Keen', 'Lucky', 'Mellow', 'Nimble', 'Proud',
  'Quiet', 'Rustic', 'Sleek', 'Tidal', 'Urban', 'Vivid', 'Witty', 'Zen',
];

const ANIMALS = [
  'Fox', 'Wolf', 'Owl', 'Raven', 'Falcon', 'Panther', 'Lynx', 'Viper',
  'Eagle', 'Tiger', 'Bear', 'Hawk', 'Shark', 'Cobra', 'Crane', 'Dolphin',
  'Jaguar', 'Leopard', 'Mantis', 'Orca', 'Phoenix', 'Python', 'Sparrow',
  'Dragon', 'Griffin', 'Hydra', 'Kraken', 'Pegasus', 'Sphinx', 'Wyvern',
  'Badger', 'Bobcat', 'Coyote', 'Dingo', 'Ferret', 'Gazelle', 'Heron',
  'Ibis', 'Jackal', 'Kestrel', 'Lemur', 'Marten', 'Newt', 'Osprey',
  'Puma', 'Quail', 'Raccoon', 'Stag',
];

const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
  '#f59e0b', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
  '#a855f7', '#e11d48', '#0891b2', '#059669', '#d946ef',
];

/**
 * Generate a unique random name for a room
 * @param {Set<string>} existingNames - Names already used in the room
 * @returns {{ name: string, color: string }}
 */
export function generateName(existingNames = new Set()) {
  let attempts = 0;
  const maxAttempts = 200;

  while (attempts < maxAttempts) {
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
    const name = `${adj} ${animal}`;

    if (!existingNames.has(name)) {
      const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
      return { name, color };
    }
    attempts++;
  }

  // Fallback: add a number
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  const num = Math.floor(Math.random() * 100);
  const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
  return { name: `${adj} ${animal} ${num}`, color };
}
