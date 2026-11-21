import assert from 'node:assert/strict';
import test from 'node:test';
import { transferInstructions, transferReference } from '../backend/src/services/paymentBank.js';

test('KLCN BIDV beneficiary is preserved for Vietnamese transfers', () => {
  const quote = transferInstructions('order', '507f1f77bcf86cd799439011', 220000);
  assert.equal(quote.bankName, 'BIDV');
  assert.equal(quote.bankBin, '970418');
  assert.equal(quote.bankAccountNo, '5811704638');
  assert.equal(quote.bankAccountName, 'HUYNH DUC TOAN');
  assert.equal(quote.amount, 220000);
  assert.equal(quote.content, 'TTDON507F1F77BCF86CD799439011');
  const url = new URL(quote.qrUrl);
  assert.equal(url.hostname, 'img.vietqr.io');
  assert.ok(url.pathname.includes('970418-5811704638'));
  assert.equal(url.searchParams.get('amount'), '220000');
  assert.equal(url.searchParams.get('addInfo'), quote.content);
  assert.equal(url.searchParams.get('accountName'), 'HUYNH DUC TOAN');
  assert.equal(quote.qrPayload.slice(0, 12), '000201010212');
});

test('EMV VietQR checksum validates and differs between invoices', () => {
  const quote = transferInstructions('session', '507f191e810c19729de860ea', 375000);
  const value = quote.qrPayload;
  let crc = 0xffff;
  for (const byte of Buffer.from(value.slice(0, -4), 'ascii')) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) {
      crc = ((crc << 1) ^ ((crc & 0x8000) ? 0x1021 : 0)) & 0xffff;
    }
  }
  assert.equal(value.slice(-4), crc.toString(16).toUpperCase().padStart(4, '0'));
  assert.notEqual(
    transferReference('session', '507f191e810c19729de860ea'),
    transferReference('order', '507f191e810c19729de860ea')
  );
  assert.equal(transferInstructions('session', 'x', 0), null);
});
