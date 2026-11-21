import { useEffect, useRef, useState } from 'react';
import { Banknote, CheckCircle2, ClipboardCopy, CreditCard, RefreshCw, X } from 'lucide-react';
import { api, money } from '../lib/api.js';

export default function PaymentDialog({
  scope, id, readOnly = false, suggestedMethod = 'cash', onClose, onPaid
}) {
  const [quote, setQuote] = useState(null);
  const [method, setMethod] = useState(suggestedMethod === 'bank-transfer' ? 'bank-transfer' : 'cash');
  const [cashReceived, setCashReceived] = useState('');
  const [bankTransactionRef, setBankTransactionRef] = useState('');
  const [bankVerified, setBankVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const requestId = useRef(null);

  const load = async () => {
    setError('');
    const response = await api('/api/payments/' + scope + '/' + id + '/quote');
    setQuote(response.quote);
    setCashReceived(String(response.quote.amount));
  };
  useEffect(() => {
    load().catch(e => setError(e.message));
  }, [scope, id]);

  const copyText = async value => {
    try { await navigator.clipboard.writeText(String(value)); } catch {
      setError('Trình duyệt không cho phép sao chép. Bạn có thể chọn và sao chép nội dung trực tiếp.');
    }
  };
  const confirm = async () => {
    if (!quote || busy) return;
    setBusy(true);
    setError('');
    try {
      if (!requestId.current) requestId.current = crypto.randomUUID();
      const body = {
        method, expectedAmount: quote.amount, requestId: requestId.current,
        ...(method === 'cash'
          ? { cashReceived: Number(cashReceived) }
          : { bankVerifiedManually: bankVerified, bankTransactionRef: bankTransactionRef.trim() })
      };
      const result = await api('/api/payments/' + scope + '/' + id + '/confirm', {
        method: 'POST', body: JSON.stringify(body)
      });
      if (onPaid) await onPaid(result.receipt);
      onClose();
    } catch (e) {
      // A stale quote or an interrupted request must not declare success.
      await load().catch(() => {});
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const transfer = quote?.transfer;
  const changeAmount = Number(cashReceived) - (quote?.amount || 0);
  return <div className="payment-modal-backdrop" onClick={onClose} role="presentation">
    <section className="payment-modal" role="dialog" aria-modal="true" aria-label="Thanh toán hóa đơn"
      onClick={event => event.stopPropagation()}>
      <header className="payment-modal-header">
        <div><span className="eyebrow">THANH TOÁN</span><h2>{readOnly ? 'Thông tin chuyển khoản' : 'Thu tiền hóa đơn'}</h2></div>
        <button type="button" className="secondary-button" onClick={onClose} title="Đóng"><X size={18}/></button>
      </header>
      {error && <p className="payment-error">{error}</p>}
      {!quote ? <p>Đang tải hóa đơn...</p> : <>
        <div className="payment-total"><span>Tổng tiền hóa đơn</span><strong>{money(quote.total)}</strong></div>
        <div className="payment-total"><span>Còn phải thanh toán</span><strong>{money(quote.amount)}</strong></div>
        {quote.alreadyPaid ? <div className="payment-done">
          <CheckCircle2 size={24}/><div><b>Hóa đơn đã được ghi nhận thanh toán</b>
            {quote.receipt && <p>Phiếu thu {quote.receipt.receiptCode} · {quote.receipt.method === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}</p>}</div>
        </div> : <>
          {!readOnly && <div className="payment-methods">
            <button type="button" className={method === 'cash' ? 'active' : ''} onClick={() => setMethod('cash')}>
              <Banknote size={20}/> Tiền mặt
            </button>
            <button type="button" className={method === 'bank-transfer' ? 'active' : ''} onClick={() => setMethod('bank-transfer')}>
              <CreditCard size={20}/> Chuyển khoản
            </button>
          </div>}
          {method === 'cash' ? <div className="payment-cash">
            {readOnly ? <p>Vui lòng thanh toán tiền mặt trực tiếp tại quầy thu ngân.</p> : <>
              <label>Số tiền khách đưa (VND)<input type="number" min={quote.amount} step="1000" value={cashReceived}
                onChange={e => setCashReceived(e.target.value)}/></label>
              <p>Tiền trả lại: <strong>{money(Math.max(0, changeAmount))}</strong></p>
            </>}
          </div> : transfer && <div className="payment-transfer">
            <div className="payment-qr"><img src={transfer.qrUrl} alt="Mã VietQR chuyển khoản BIDV theo số tiền hóa đơn"/></div>
            <div className="payment-bank-fields">
              <p><span>Ngân hàng</span><b>{transfer.bankName} · {transfer.bankBranch}</b></p>
              <p><span>Chủ tài khoản</span><b>{transfer.bankAccountName}</b></p>
              <p><span>Số tài khoản</span><b>{transfer.bankAccountNo}</b><button onClick={() => copyText(transfer.bankAccountNo)} title="Sao chép số tài khoản"><ClipboardCopy size={15}/></button></p>
              <p><span>Số tiền</span><b>{money(transfer.amount)}</b><button onClick={() => copyText(transfer.amount)} title="Sao chép số tiền"><ClipboardCopy size={15}/></button></p>
              <p><span>Nội dung chuyển khoản</span><b>{transfer.content}</b><button onClick={() => copyText(transfer.content)} title="Sao chép nội dung"><ClipboardCopy size={15}/></button></p>
            </div>
            <p className="payment-notice">Quét QR chỉ tạo lệnh chuyển khoản, không tự xác nhận tiền đã về tài khoản. Cần chuyển đúng số tiền và nội dung.</p>
            {!readOnly && <>
              <label>Mã giao dịch thực nhận trên ứng dụng ngân hàng
                <input maxLength={100} minLength={5} placeholder="Nhập mã giao dịch sau khi đã nhận tiền"
                  value={bankTransactionRef} onChange={e => setBankTransactionRef(e.target.value)}/>
              </label>
              <label className="payment-verified"><input type="checkbox" checked={bankVerified}
                onChange={e => setBankVerified(e.target.checked)}/>
                Tôi đã kiểm tra trên tài khoản ngân hàng và xác nhận tiền đã nhận đúng số tiền hóa đơn.
              </label>
            </>}
          </div>}
          {!readOnly && <div className="payment-confirm">
            {!quote.allServed && scope === 'session' && <p>Chưa thể thu tiền: có món chưa hoàn thành phục vụ.</p>}
            <button type="button" className="order-button" onClick={confirm}
              disabled={busy || !quote.allServed || quote.amount <= 0 ||
                (method === 'cash' ? !Number.isInteger(Number(cashReceived)) || Number(cashReceived) < quote.amount
                  : !bankVerified || bankTransactionRef.trim().length < 5)}>
              {busy ? 'Đang xác nhận...' : method === 'cash' ? 'Xác nhận đã nhận tiền mặt' : 'Xác nhận đã nhận chuyển khoản'}
            </button>
            <button type="button" className="secondary-button" onClick={() => load().catch(e => setError(e.message))} disabled={busy}><RefreshCw size={14}/> Tải lại số tiền</button>
          </div>}
          {readOnly && <p className="payment-notice">Thanh toán sẽ hiển thị hoàn tất sau khi thu ngân kiểm tra và xác nhận.</p>}
        </>}
      </>}
    </section>
  </div>;
}
