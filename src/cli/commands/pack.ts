import { Command } from 'commander';
import { resolve } from 'path';
import {
  createPack,
  installPack,
  listPacks,
  readPackManifest,
} from '../../infrastructure/PackLoader.js';

export const packCommand = new Command('pack').description(
  'Create, install, and list local cclint rule packs'
);

packCommand
  .command('create')
  .description('Scaffold a local pack directory (pack.json + config.json)')
  .argument('<name>', 'Pack name (e.g. my-rules or @acme/strict)')
  .option('-d, --dir <path>', 'Parent directory for the new pack', '.')
  .action((name: string, options: { dir: string }) => {
    try {
      const packRoot = createPack(name, resolve(process.cwd(), options.dir));
      console.log(`Created pack at ${packRoot}`);
      console.log(`Install with: cclint pack install ${packRoot}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Error: ${msg}`);
      process.exit(1);
    }
  });

packCommand
  .command('install')
  .description(
    'Install a pack from a path into .cclint/packs (built-in presets need no install)'
  )
  .argument('<path-or-name>', 'Pack directory path, or a built-in preset name')
  .action((source: string) => {
    try {
      const dest = installPack(source, process.cwd());
      if (dest === null) {
        console.log(
          `"${source}" is a built-in preset — use "extends": "${source}" in .cclintrc.json (no install needed).`
        );
        return;
      }
      const { name } = readPackManifest(dest);
      console.log(`Installed pack to ${dest}`);
      console.log(`Add to .cclintrc.json: { "extends": "${name}" }`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Error: ${msg}`);
      process.exit(1);
    }
  });

packCommand
  .command('list')
  .description('List built-in presets and packs installed under .cclint/packs')
  .action(() => {
    const packs = listPacks(process.cwd());
    if (packs.length === 0) {
      console.log('No packs found.');
      return;
    }
    for (const pack of packs) {
      const where =
        pack.source === 'builtin' ? 'builtin' : (pack.path ?? 'installed');
      const desc = pack.description ? ` — ${pack.description}` : '';
      console.log(`${pack.name}@${pack.version}  [${where}]${desc}`);
    }
  });
