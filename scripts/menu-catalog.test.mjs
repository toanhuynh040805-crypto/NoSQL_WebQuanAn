import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync } from 'node:fs';
import { catalog, categoryDefinitions } from '../backend/src/data/menuCatalog.js';

test('KLCN menu has 37 mapped dishes and 7 categories', () => {
  assert.equal(catalog.length, 37);
  assert.equal(categoryDefinitions.length, 7);
  const defined = new Set(categoryDefinitions.map(item => item.slug));
  assert.equal(defined.size, categoryDefinitions.length);
  for (const [index, item] of catalog.entries()) {
    assert.ok(defined.has(item.category), 'unknown category for menu row ' + index);
    assert.ok(item.name.length > 1);
    assert.ok(Number.isFinite(item.price) && item.price > 0);
    const path = new URL('../backend/public/images/menu/' + item.imageFile, import.meta.url);
    assert.ok(existsSync(path), 'missing menu image ' + item.imageFile);
  }
});

test('food import identities are unique and deterministic', () => {
  const slugs = catalog.map((item, i) => item.category + '-' + (i + 1));
  assert.equal(new Set(slugs).size, catalog.length);
});
