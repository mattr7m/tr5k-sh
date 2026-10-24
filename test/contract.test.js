import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePublish, toSlugList, noteDate, slugify, compareNotes, formatDate } from '../src/contract.js';

test('publish: default deny', () => {
  for (const v of [undefined, null, '', [], '  ']) assert.equal(normalizePublish(v).size, 0);
});

test('publish: scalar, all, list, unknown', () => {
  assert.deepEqual([...normalizePublish('public')], ['public']);
  assert.deepEqual([...normalizePublish('PRIVATE')], ['private']);
  assert.deepEqual([...normalizePublish('all')].sort(), ['private', 'public']);
  assert.deepEqual([...normalizePublish(['public', 'private'])].sort(), ['private', 'public']);
  const warns = [];
  assert.equal(normalizePublish('draft', (m) => warns.push(m)).size, 0);
  assert.equal(warns.length, 1);
});

test('lists: YAML list or comma string, slugified + deduped', () => {
  assert.deepEqual(toSlugList(['Personal', 'personal', 'Reads & Reviews']), ['personal', 'reads-reviews']);
  assert.deepEqual(toSlugList('infra, Hacking'), ['infra', 'hacking']);
  assert.deepEqual(toSlugList(undefined), []);
});

test('date: tr5k-sh-date, then created, never anything else', () => {
  assert.equal(noteDate({ 'tr5k-sh-date': new Date('2026-01-02') }).toISOString().slice(0, 10), '2026-01-02');
  assert.equal(noteDate({ created: '2025-05-05' }).toISOString().slice(0, 10), '2025-05-05');
  assert.equal(noteDate({ modified: '2026-01-01' }), null);
});

test('ordering: newest first, undated last', () => {
  const a = { title: 'a', date: new Date('2026-01-01') };
  const b = { title: 'b', date: new Date('2026-02-01') };
  const c = { title: 'c', date: null };
  assert.deepEqual([c, a, b].sort(compareNotes).map((x) => x.title), ['b', 'a', 'c']);
});

test('slug + date formatting match the mock', () => {
  assert.equal(slugify('Secret Plans!'), 'secret-plans');
  assert.equal(formatDate(new Date('2025-11-04')), 'Nov 04, 2025');
});
