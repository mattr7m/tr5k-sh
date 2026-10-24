import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildAll, loadConfig } from '../src/build.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

test('CONTENT_ROOT overrides the configured content folder', () => {
  assert.equal(loadConfig(undefined, {}).contentRoot, 'tr5k-sh');
  assert.equal(loadConfig(undefined, { CONTENT_ROOT: 'tr5k.sh' }).contentRoot, 'tr5k.sh');
});

test('a dotted content folder builds, and the default-named folder becomes drift', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tr5k-sh-root-'));
  const vault = path.join(tmp, 'vault');
  fs.cpSync(path.join(HERE, 'fixtures', 'vault'), vault, { recursive: true });
  fs.renameSync(path.join(vault, 'tr5k-sh'), path.join(vault, 'tr5k.sh'));
  const config = loadConfig(undefined, { CONTENT_ROOT: 'tr5k.sh' });
  const { results, collected } = buildAll({ vaultDir: vault, publicOut: path.join(tmp, 'p'), privateOut: path.join(tmp, 'q'), config });
  assert.equal(results.public.count, 5);
  assert.ok(fs.existsSync(path.join(tmp, 'p', 'current', 'posts', 'bench-build', 'index.html')));
  assert.ok(collected.warnings.some((w) => w.message.includes('"journal" synced outside tr5k.sh/')));
});
