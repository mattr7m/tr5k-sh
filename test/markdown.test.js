import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRenderer } from '../src/markdown.js';

const render = createRenderer({ notesByName: new Map(), assets: new Map(), usedAssets: new Set(), warn() {} });

test('tables render inside a focusable, labelled horizontal-scroll wrapper', () => {
  const html = render('| Biller | Apr | Amt |\n|---|:---:|---:|\n| A | [4/8](https://x.example)<br>$1.00 | 3 |\n');
  assert.match(html, /<div class="table-wrap" role="region" aria-label="[^"]+" tabindex="0">\s*<table>/);
  assert.match(html, /<\/table>\s*<\/div>/);
  // column alignment from the delimiter row survives
  assert.match(html, /<td style="text-align:center"><a href="https:\/\/x\.example">4\/8<\/a><br>\$1\.00<\/td>/);
  assert.match(html, /<td style="text-align:right">3<\/td>/);
});

test('every table gets its own wrapper', () => {
  const t = '| a |\n|---|\n| 1 |\n';
  const html = render(`${t}\ntext\n\n${t}`);
  assert.equal((html.match(/class="table-wrap"/g) || []).length, 2);
  assert.equal((html.match(/<\/table>\s*<\/div>/g) || []).length, 2);
});
