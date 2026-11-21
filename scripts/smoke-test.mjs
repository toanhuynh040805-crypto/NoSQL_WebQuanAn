import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const root = 'http://127.0.0.1:5000';
async function request(method, path, token, body, expected = 200) {
  const response = await fetch(root + path, {
    method,
    headers: {
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  const data = response.status === 204 ? {} : await response.json().catch(() => ({}));
  assert.equal(
    response.status, expected,
    method + ' ' + path + ': expected HTTP ' + expected + ', got ' + response.status + ': ' + JSON.stringify(data)
  );
  return data;
}
const login = async email => request('POST', '/api/auth/login', null, { email, password: '123456' });

const staff = await login('staff@quanan.vn');
const cashier = await login('thungan@quanan.vn');
const kitchen = await login('bep@quanan.vn');
const admin = await login('admin@quanan.vn');
const customer = await login('khach@quanan.vn');
const st = staff.token, ct = cashier.token, kt = kitchen.token, at = admin.token, ut = customer.token;

await request('GET', '/api/staff/tables', ut, undefined, 403);
await request('GET', '/api/staff/tables', kt, undefined, 403);

const floors = await request('GET', '/api/staff/tables', st);
const candidates = floors.tables.filter(t => t.status === 'available' && t.capacity >= 2);
assert.ok(candidates.length >= 4, 'need available sample tables');
const [table, dest, other, booked] = candidates;
const menu = await request('GET', '/api/foods?limit=50', st);
assert.ok(menu.foods.length > 0, 'menu should be seeded');

const opened = await request('POST', '/api/staff/tables/' + table._id + '/open', st, {
  guestCount: 2, customerName: 'Khách thử nghiệm CI'
}, 201);
const sessionId = opened.session._id;
const details = await request('GET', '/api/staff/sessions/' + sessionId, st);
assert.equal(details.lock.ownerId, staff.user.id, 'lock owner is publicUser.id');
await request('POST', '/api/staff/tables/' + table._id + '/open', st, { guestCount: 2 }, 409);
await request('PUT', '/api/tables/' + table._id, at, { status: 'available' }, 409);

const requestId = randomUUID();
const item = { foodId: menu.foods[0]._id, quantity: 2, note: 'Không cay' };
const first = await request('POST', '/api/staff/sessions/' + sessionId + '/orders', st, {
  items: [item], priority: 'urgent', clientRequestId: requestId
}, 201);
assert.equal(first.order.source, 'staff');
assert.equal(first.order.priority, 'urgent');
const again = await request('POST', '/api/staff/sessions/' + sessionId + '/orders', st, {
  items: [item], priority: 'urgent', clientRequestId: requestId
});
assert.equal(again.duplicate, true, 'replayed order request must be idempotent');
const orderId = first.order._id;
const adjusted = await request('PATCH', '/api/staff/orders/' + orderId + '/items/0', st, {
  quantity: 3
});
assert.equal(adjusted.order.items[0].quantity, 3);

await request('PATCH', '/api/orders/' + orderId + '/status', kt, { status: 'preparing' });
await request('PATCH', '/api/staff/orders/' + orderId + '/items/0', st, { quantity: 4 }, 409);
await request('PATCH', '/api/orders/' + orderId + '/status', kt, { status: 'ready' });
await request('PATCH', '/api/orders/' + orderId + '/status', st, { status: 'completed' });
const billQuote = (await request('GET', '/api/payments/session/' + sessionId + '/quote', ct)).quote;
assert.equal(billQuote.amount, menu.foods[0].price * 3, 'table bill must reflect updated quantity');
assert.equal(billQuote.transfer.bankName, 'BIDV');
assert.equal(billQuote.transfer.bankBin, '970418');
assert.equal(billQuote.transfer.bankAccountNo, '5811704638');
assert.match(billQuote.transfer.qrUrl, /img\.vietqr\.io/);
await request('PATCH', '/api/orders/' + orderId + '/payment', ct, { paymentStatus: 'paid' }, 410);
await request('POST', '/api/payments/session/' + sessionId + '/confirm', ct, {
  method: 'cash', expectedAmount: billQuote.amount,
  cashReceived: billQuote.amount + 50000, requestId: randomUUID()
}, 423);
await request('PATCH', '/api/staff/sessions/' + sessionId + '/close', ct, undefined, 423);
await request('DELETE', '/api/staff/sessions/' + sessionId + '/lock', st, undefined, 204);
const cashPaymentRequest = {
  method: 'cash', expectedAmount: billQuote.amount,
  cashReceived: billQuote.amount + 50000, requestId: randomUUID()
};
const cashPaid = await request('POST', '/api/payments/session/' + sessionId + '/confirm', ct, cashPaymentRequest, 201);
assert.equal(cashPaid.receipt.changeAmount, 50000);
assert.equal(cashPaid.receipt.method, 'cash');
const replay = await request('POST', '/api/payments/session/' + sessionId + '/confirm', ct, cashPaymentRequest);
assert.equal(replay.duplicate, true, 'double submit must not produce another receipt');
const settled = await request('GET', '/api/staff/sessions/' + sessionId, ct);
assert.ok(settled.orders.every(order => order.paymentStatus === 'paid'));

const closed = await request('PATCH', '/api/staff/sessions/' + sessionId + '/close', ct);
assert.equal(closed.session.status, 'closed');
const after = await request('GET', '/api/staff/tables', st);
assert.equal(after.tables.find(t => t._id === table._id)?.status, 'available');

const second = await request('POST', '/api/staff/tables/' + other._id + '/open', st, {
  guestCount: 2
}, 201);
await request('PATCH', '/api/staff/sessions/' + second.session._id + '/transfer', st, {
  destinationTableId: dest._id
});
const transferred = await request('GET', '/api/staff/sessions/' + second.session._id, st);
assert.equal(transferred.session.tableNumber, dest.name);
await request('DELETE', '/api/staff/sessions/' + second.session._id + '/lock', st, undefined, 204);
await request('PATCH', '/api/staff/sessions/' + second.session._id + '/close', ct);

const date = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
const reserve = await request('POST', '/api/reservations', ut, {
  reservedAt: date, guestCount: 2, phone: '0988123456'
}, 201);
await request('PATCH', '/api/reservations/' + reserve.reservation._id + '/status', at, {
  status: 'confirmed', tableId: booked._id
});
const fromFuture = await request('GET', '/api/staff/tables', st);
assert.equal(fromFuture.tables.find(t => t._id === booked._id)?.status, 'available', 'future bookings must not block table now');

const duplicateBooking = await request('POST', '/api/reservations', ut, {
  reservedAt: date, guestCount: 2, phone: '0988123456'
}, 201);
await request('PATCH', '/api/reservations/' + duplicateBooking.reservation._id + '/status', at, {
  status: 'confirmed', tableId: booked._id
}, 409);
await request('PATCH', '/api/reservations/' + reserve.reservation._id + '/cancel', ut);

// Customer takes away food and views a personal bank-transfer quote.
// The QR does NOT mark the bill paid until the cashier verifies the received funds.
await request('PUT', '/api/cart/items/' + menu.foods[0]._id, ut, { quantity: 1 });
const takeaway = await request('POST', '/api/orders', ut, {
  orderType: 'takeaway', paymentMethod: 'bank-transfer'
}, 201);
const customerQuote = (await request('GET', '/api/payments/order/' + takeaway.order._id + '/quote', ut)).quote;
assert.equal(customerQuote.transfer.bankAccountName, 'HUYNH DUC TOAN');
assert.equal(customerQuote.amount, takeaway.order.totalAmount);
await request('POST', '/api/payments/order/' + takeaway.order._id + '/confirm', ut, {
  method: 'bank-transfer', expectedAmount: customerQuote.amount,
  bankVerifiedManually: true, bankTransactionRef: 'TEST-REF-CUSTOMER-1001', requestId: randomUUID()
}, 403);
await request('POST', '/api/payments/order/' + takeaway.order._id + '/confirm', ct, {
  method: 'bank-transfer', expectedAmount: customerQuote.amount,
  bankVerifiedManually: false, bankTransactionRef: 'TEST-REF-CUSTOMER-1001', requestId: randomUUID()
}, 400);
const wire = await request('POST', '/api/payments/order/' + takeaway.order._id + '/confirm', ct, {
  method: 'bank-transfer', expectedAmount: customerQuote.amount,
  bankVerifiedManually: true, bankTransactionRef: 'TEST-REF-CUSTOMER-1001', requestId: randomUUID()
}, 201);
assert.equal(wire.receipt.method, 'bank-transfer');
assert.equal(wire.receipt.bankVerifiedManually, true);
const afterWire = (await request('GET', '/api/orders/mine', ut)).orders
  .find(order => order._id === takeaway.order._id);
assert.equal(afterWire.paymentStatus, 'paid');
assert.equal(afterWire.paymentMethod, 'bank-transfer');
console.log('PASS: waiter, kitchen, cashier, cash change, VietQR, manually verified transfer, reservation conflicts.');
