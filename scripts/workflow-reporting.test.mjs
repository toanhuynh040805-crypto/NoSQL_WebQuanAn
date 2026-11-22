import test from 'node:test';
import assert from 'node:assert/strict';
import { validateOrderTransition } from '../backend/src/services/orderWorkflow.js';
import { reportRange, vietnamDate } from '../backend/src/utils/reporting.js';
import { transferInstructions } from '../backend/src/services/paymentBank.js';
import qrcode from '../frontend/src/vendor/qrcode.js';

test('order workflow rejects skipped stages, rewinds, and changes after completion', () => {
  for (const [from, to] of [['pending', 'completed'], ['preparing', 'confirmed'], ['ready', 'cancelled'], ['completed', 'ready'], ['cancelled', 'confirmed']]) {
    assert.throws(() => validateOrderTransition({ status: from, paymentStatus: 'pending' }, to, 'admin'), { status: 409 });
  }
});
test('kitchen cannot confirm payment or complete service; paid orders cannot be cancelled', () => {
  assert.throws(() => validateOrderTransition({ status: 'ready' }, 'completed', 'kitchen'), { status: 403 });
  assert.throws(() => validateOrderTransition({ status: 'confirmed', paymentStatus: 'paid' }, 'cancelled', 'admin'), { status: 409 });
  assert.doesNotThrow(() => validateOrderTransition({ status: 'confirmed' }, 'preparing', 'kitchen'));
  assert.doesNotThrow(() => validateOrderTransition({ status: 'ready' }, 'completed', 'cashier'));
});
test('same Vietnam reporting date has exact UTC+7 boundaries even on UTC hosts', () => {
  const range = reportRange({ from: '2026-11-22', to: '2026-11-22' });
  assert.equal(range.from.toISOString(), '2026-11-21T17:00:00.000Z');
  assert.equal(range.to.toISOString(), '2026-11-22T16:59:59.999Z');
  assert.equal(vietnamDate(new Date('2026-11-21T18:00:00Z')), '2026-11-22');
});
test('report validates calendar days, query shapes, inverted and oversized intervals', () => {
  for (const query of [{ from: '2026-02-30' }, { from: ['2026-11-22'] }, { from: 'x' }, { from: '2026-11-23', to: '2026-11-22' }, { from: '2020-01-01', to: '2026-11-22' }]) {
    assert.throws(() => reportRange(query), { status: 400 });
  }
  const range = reportRange({}, new Date('2026-11-22T14:00:00Z'));
  assert.equal(range.to.getTime() - range.from.getTime(), 30 * 86400000 - 1);
});
test('VietQR renders locally as SVG without an external image or network request', () => {
  const transfer = transferInstructions('order', '0123456789abcdef01234567', 222000);
  const qr = qrcode(0, 'M'); qr.addData(transfer.qrPayload, 'Byte'); qr.make();
  const svg = qr.createSvgTag({ cellSize: 4, margin: 16 });
  assert.match(svg, /^<svg/);
  assert.match(svg, /<path/);
  assert.ok(qr.getModuleCount() >= 21);
  assert.equal((qr.getModuleCount() - 17) % 4, 0);
  assert.ok(!svg.includes('<image') && !svg.includes('img.vietqr.io'));
});
