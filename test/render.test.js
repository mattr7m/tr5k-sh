import { test } from 'node:test';
import assert from 'node:assert/strict';
import { postCard } from '../src/render.js';
import { toClassList } from '../src/contract.js';

test('toClassList: list, string and legacy forms; only safe class names survive', () => {
  assert.deepEqual(toClassList(['monthly-calendar']), ['monthly-calendar']);
  assert.deepEqual(toClassList('wide  monthly-calendar'), ['wide', 'monthly-calendar']);
  assert.deepEqual(toClassList(['"><script>', 'Two Words']), ['script', 'two-words']);
  assert.deepEqual(toClassList(undefined), []);
});

test('postCard adds the note\'s cssclasses to the article', () => {
  const note = { title: 't', date: null, categories: [], tags: [], cssClasses: ['monthly-calendar'] };
  assert.match(postCard(note, '<p>x</p>', new Map()), /<article class="content page-card paper-ruled monthly-calendar">/);
  assert.match(postCard({ ...note, cssClasses: [] }, '', new Map()), /<article class="content page-card paper-ruled">/);
});
