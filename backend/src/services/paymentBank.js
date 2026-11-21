// Matched to KLCN QuanAnBackend/Services/ReceiptProfile.cs, 21 Nov 2026.
// Environment overrides allow changing the restaurant's receiving bank later.
const bank = {
  name: process.env.PAYMENT_BANK_NAME || 'BIDV',
  bin: process.env.PAYMENT_BANK_BIN || '970418',
  accountNo: process.env.PAYMENT_BANK_ACCOUNT || '5811704638',
  accountName: process.env.PAYMENT_BANK_HOLDER || 'HUYNH DUC TOAN',
  branch: process.env.PAYMENT_BANK_BRANCH || 'BIDV - PGD Phú Phong'
};
const tlv = (id, value) => id + String(Buffer.byteLength(String(value), 'utf8')).padStart(2, '0') + value;
function crc16(input) {
  let crc = 0xffff;
  for (const byte of Buffer.from(input, 'ascii')) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}
export function transferReference(scopeType, id) {
  return (scopeType === 'session' ? 'TTBAN' : 'TTDON') + String(id).toUpperCase();
}
export function transferInstructions(scopeType, id, amount) {
  if (!Number.isSafeInteger(amount) || amount <= 0) return null;
  const content = transferReference(scopeType, id);
  const beneficiary = tlv('00', bank.bin) + tlv('01', bank.accountNo);
  const merchant = tlv('00', 'A000000727') + tlv('01', beneficiary) + tlv('02', 'QRIBFTTA');
  const payload = '000201010212' + tlv('38', merchant) + tlv('53', '704')
    + tlv('54', String(amount)) + tlv('58', 'VN') + tlv('62', tlv('08', content));
  const qrPayload = payload + '6304' + crc16(payload + '6304');
  const qrUrl = 'https://img.vietqr.io/image/'
    + encodeURIComponent(bank.bin) + '-' + encodeURIComponent(bank.accountNo) + '-compact2.png'
    + '?amount=' + amount + '&addInfo=' + encodeURIComponent(content)
    + '&accountName=' + encodeURIComponent(bank.accountName);
  return {
    bankName: bank.name, bankBin: bank.bin,
    bankAccountNo: bank.accountNo, bankAccountName: bank.accountName,
    bankBranch: bank.branch, amount, content, qrUrl, qrPayload,
    verificationMode: 'manual-cashier'
  };
}
