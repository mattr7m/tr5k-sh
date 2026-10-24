import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildAll, BuildError } from '../src/build.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const VAULT = path.join(HERE, 'fixtures', 'vault');
let pub; let priv; let result;

function allFiles(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) allFiles(p, out); else out.push(p);
  }
  return out;
}
const read = (root, rel) => fs.readFileSync(path.join(root, 'current', rel), 'utf8');
const exists = (root, rel) => fs.existsSync(path.join(root, 'current', rel));

before(() => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tr5k-sh-test-'));
  pub = path.join(tmp, 'public'); priv = path.join(tmp, 'private');
  result = buildAll({ vaultDir: VAULT, publicOut: pub, privateOut: priv });
});

// ── The boundary: nothing private-only, unpublished, or outside the content
//    root may leave any trace in the public tree. ─────────────────────────────
test('LEAK: public tree has zero trace of private/unpublished/out-of-root content', () => {
  const forbidden = ['PRIVATE-MARKER-XYZ', 'Secret Plans', 'secret-plans', 'secret-diagram', 'PNGSECRET',
    'DRAFT-MARKER', 'draft-idea', 'JOURNAL-MARKER', 'journal', '_status', 'persnal'];
  const files = allFiles(path.join(pub, 'current'));
  for (const f of files) {
    const body = fs.readFileSync(f, 'latin1');
    for (const needle of forbidden) {
      assert.ok(!body.includes(needle), `public file ${path.relative(pub, f)} contains "${needle}"`);
      assert.ok(!path.basename(f).includes(needle), `public tree has a file named like "${needle}"`);
    }
  }
});

test('wikilink to a note outside the site renders as the author\'s text, no href', () => {
  const html = read(pub, 'posts/bench-build/index.html');
  assert.ok(html.includes('my other plans'));
  assert.ok(!html.includes('/posts/secret-plans/'));
  assert.ok(html.includes('Draft Idea'), 'unaliased out-of-site link keeps the written target text');
  assert.ok(!html.includes('/posts/draft-idea/'));
  assert.ok(html.includes('<a href="/posts/shop-notes/">Shop Notes</a>'), 'in-site link resolves');
});

test('private site: has private + all notes, its image, and the status page', () => {
  assert.ok(read(priv, 'posts/secret-plans/index.html').includes('PRIVATE-MARKER-XYZ'));
  assert.ok(exists(priv, 'assets/secret-diagram.png'));
  assert.ok(exists(priv, 'posts/shop-notes/index.html'));
  assert.ok(!exists(priv, 'posts/bench-build/index.html'), 'public-only note stays out of private');
  assert.ok(read(priv, '_status/index.html').includes('journal'), 'drift reported privately');
  assert.ok(read(priv, 'index.html').includes('noindex'));
});

test('publish: all lands in both sites; unpublished in neither', () => {
  assert.ok(exists(pub, 'posts/shop-notes/index.html') && exists(priv, 'posts/shop-notes/index.html'));
  assert.ok(!exists(pub, 'posts/draft-idea/index.html') && !exists(priv, 'posts/draft-idea/index.html'));
});

test('category index: newest first; tag view is the intersection', () => {
  const cat = read(pub, 'personal/index.html');
  assert.ok(cat.indexOf('Shop Notes') < cat.indexOf('Bench Build'), 'newest first');
  assert.ok(exists(pub, 'personal/tools/index.html'));
  const tools = read(pub, 'personal/tools/index.html');
  assert.ok(tools.includes('Shop Notes') && !tools.includes('Bench Build'));
  const privCat = read(priv, 'personal/index.html');
  assert.ok(privCat.indexOf('Shop Notes') < privCat.indexOf('Secret Plans'));
});

test('undated notes sort last and are flagged; unknown categories are not listed', () => {
  assert.ok(read(pub, 'infra/homelab/index.html').includes('Undated Note'));
  const warnings = result.collected.warnings.map((w) => w.message).join('\n');
  assert.match(warnings, /no tr5k-sh-date/);
  assert.match(warnings, /unknown category "persnal"/);
  assert.ok(!read(pub, 'personal/index.html').includes('Typo Note'));
});

test('callouts, highlight, mark, embeds, heading anchors, About page', () => {
  const html = read(pub, 'posts/bench-build/index.html');
  assert.match(html, /<div class="callout callout-note"><div class="callout-label">Glue-up<\/div>/);
  assert.ok(html.includes('<mark>Measure twice.</mark>'));
  assert.ok(html.includes('hljs-'));
  assert.ok(html.includes('<img src="/assets/bench-photo.png"'));
  assert.ok(exists(pub, 'assets/bench-photo.png'));
  assert.ok(read(pub, 'posts/shop-notes/index.html').includes('/posts/bench-build/#glue-up'));
  assert.ok(read(pub, 'about/index.html').includes('ABOUT-MARKER'));
  assert.ok(!exists(pub, 'posts/about/index.html'), 'About is a nav page, not a post');
});

test('slug collision fails the build instead of overwriting', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tr5k-sh-coll-'));
  assert.throws(() => buildAll({ vaultDir: path.join(HERE, 'fixtures', 'collision'), publicOut: path.join(tmp, 'p'), privateOut: path.join(tmp, 'q') }), BuildError);
});
