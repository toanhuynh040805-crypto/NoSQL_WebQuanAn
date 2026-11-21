import assert from 'node:assert/strict';
import test from 'node:test';
import { getHomePath, showPublicMenu, showCustomerCart } from '../frontend/src/lib/roleHome.js';

test('each restaurant role lands in the correct workspace', () => {
  assert.equal(getHomePath('staff'), '/staff/tables');
  assert.equal(getHomePath('cashier'), '/staff/tables');
  assert.equal(getHomePath('kitchen'), '/kitchen');
  assert.equal(getHomePath('admin'), '/operations');
  assert.equal(getHomePath('customer'), '/');
  assert.equal(getHomePath(null), '/');
});

test('staff/cashier never see customer checkout navigation', () => {
  for (const role of ['staff', 'cashier', 'kitchen']) {
    assert.equal(showPublicMenu(role), false);
    assert.equal(showCustomerCart(role), false);
  }
  assert.equal(showPublicMenu('admin'), true);
  assert.equal(showCustomerCart('admin'), false);
  assert.equal(showPublicMenu('customer'), true);
  assert.equal(showCustomerCart('customer'), true);
});
