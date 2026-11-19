// Palm Coast Heat — make.fun entry program.
//
// The game itself is a folder of static files (game/) plus four
// screenshots (screenshots/). This program copies both into the output
// directory the platform names, then writes the entry dossier there
// with the kit's own builder so the submitted record matches, byte for
// byte, what the scorer computes from the same tree.

import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = dirname(fileURLToPath(import.meta.url));
const botDir = process.env.MAKEFUN_BOT_DIR || here;
const outDir = process.env.MAKEFUN_OUTPUT_DIR || join(here, 'dist');

mkdirSync(outDir, { recursive: true });
cpSync(join(botDir, 'game'), join(outDir, 'game'), { recursive: true });
cpSync(join(botDir, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
