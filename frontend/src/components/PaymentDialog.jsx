import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Banknote, CheckCircle2, ClipboardCopy, CreditCard, RefreshCw, Send, X } from 'lucide-react';
import { api, money } from '../lib/api.js';
import qrcode from '../vendor/qrcode.js';

export default function PaymentDialog({ scope, id, readOnly = false, suggestedMethod = 'cash', onClose, onPaid }) {
  const [quote, setQuote] = useState(null);
  const [method, setMethod] = useState(suggestedMethod === 'bank-transfer' ? 'bank-transfer' : 'cash');
  const [cashReceived, setCashReceived] = useState('');
  const [bankTransactionRef, setBankTransactionRef] = useState('');
  const [customerReference, setCustomerReference] = useState('');
  const [bankVerified, setBankVerified] = useState(false);
  const [takeOver, setTakeOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const requestId = useRef(null);
  const load = useCallback(async () => {
    const response = await api(`/api/payments/${scope}/${id}/quote`);
    setQuote(response.quote);
    setCashReceived(current => current || String(response.quote.amount));
  }, [scope, id]);
  useEffect(() => {
    load().catch(e => setError(e.message));
    if (!readOnly) return;
    const timer = setInterval(() => load().catch(() => {}), 8000);
    return () => clearInterval(timer);
  }, [load, readOnly]);
  useEffect(() => {
    const escape = event => { if (event.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', escape);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', escape); document.body.style.overflow = previous; };
  }, [onClose, busy]);
  const transfer = quote?.transfer;
  const qrImage = useMemo(() => {
    if (!transfer?.qrPayload) return '';
    try {
      const qr = qrcode(0, 'M'); qr.addData(transfer.qrPayload, 'Byte'); qr.make();
      return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(qr.createSvgTag({ cellSize: 4, margin: 16 }));
    } catch { return ''; }
  }, [transfer?.qrPayload]);
  const copyText = async value => {
    try { await navigator.clipboard.writeText(String(value)); setMessage('Đã sao chép'); }
    catch { setError('Bạn có thể chọn và sao chép trực tiếp nội dung hiển thị.'); }
  };
  const reportTransfer = async () => {
    if (busy || !quote) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await api(`/api/payments/${scope}/${id}/report-transfer`, {
        method: 'POST', body: JSON.stringify({ expectedAmount: quote.amount, reference: customerReference })
      });
      setMessage(result.message); await load();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  const confirm = async () => {
    if (!quote || busy) return;
    setBusy(true); setError('');
    try {
      if (!requestId.current) requestId.current = crypto.randomUUID();
      const result = await api(`/api/payments/${scope}/${id}/confirm`, {
        method: 'POST', body: JSON.stringify({
          method, expectedAmount: quote.amount, requestId: requestId.current, takeOverTableLock: takeOver,
          ...(method === 'cash' ? { cashReceived: Number(cashReceived) }
            : { bankVerifiedManually: bankVerified, bankTransactionRef: bankTransactionRef.trim() })
        })
      });
      if (onPaid) await onPaid(result.receipt);
      onClose();
    } catch (e) { await load().catch(() => {}); setError(e.message); }
    finally { setBusy(false); }
  };
  const tableHeld = quote?.tableLock && !quote.tableLock.isMine;
  const changeAmount = Number(cashReceived) - (quote?.amount || 0);
  const canConfirm = quote && quote.allServed && quote.amount > 0 && (!tableHeld || takeOver)
    && (method === 'cash' ? Number.isSafeInteger(Number(cashReceived)) && Number(cashReceived) >= quote.amount
      : bankVerified && bankTransactionRef.trim().length >= 3);

  return <div className="payment-modal-backdrop" onClick={() => !busy && onClose()} role="presentation">
    <section className="payment-modal" role="dialog" aria-modal="true" aria-label="Thanh toán hóa đơn" onClick={event => event.stopPropagation()}>
      <header className="payment-modal-header"><div><span className="eyebrow">THANH TOÁN</span><h2>{readOnly ? 'Thanh toán đơn hàng' : 'Thu tiền hóa đơn'}</h2></div>
        <button type="button" className="secondary-button" disabled={busy} onClick={onClose} aria-label="Đóng"><X size={18}/></button></header>
      {error && <p className="payment-error" role="alert">{error}</p>}
      {message && <p className="payment-success" role="status">{message}</p>}
      {!quote ? <p>Đang tải hóa đơn...</p> : <>
        <div className="payment-total"><span>Tổng tiền hóa đơn</span><strong>{money(quote.total)}</strong></div>
        <div className="payment-total"><span>Còn phải thanh toán</span><strong>{money(quote.amount)}</strong></div>
        {quote.alreadyPaid ? <div className="payment-done"><CheckCircle2 size={24}/><div><b>Hóa đơn đã được ghi nhận thanh toán</b>
          {quote.receipt && <><p>Phiếu thu {quote.receipt.receiptCode} · {quote.receipt.method === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}</p><p>{money(quote.receipt.amount)} · {new Date(quote.receipt.verifiedAt).toLocaleString('vi-VN')}</p></>}
        </div></div> : <>
          <div className="payment-methods"><button type="button" disabled={busy} className={method === 'cash' ? 'active' : ''} onClick={() => setMethod('cash')}><Banknote size={20}/> Tiền mặt</button>
            <button type="button" disabled={busy} className={method === 'bank-transfer' ? 'active' : ''} onClick={() => setMethod('bank-transfer')}><CreditCard size={20}/> Chuyển khoản</button></div>
          {method === 'cash' ? <div className="payment-cash">{readOnly ? <p>Vui lòng thanh toán tiền mặt trực tiếp tại quầy thu ngân.</p> : <>
            <label>Số tiền khách đưa (VNĐ)<input type="number" min={quote.amount} step="1" value={cashReceived} onChange={e => setCashReceived(e.target.value)}/></label>
            <p>Tiền trả lại: <strong>{money(Math.max(0, changeAmount))}</strong></p></>}
          </div> : transfer && <div className="payment-transfer">
            <div className="payment-qr">{qrImage ? <><img src={qrImage} alt={`VietQR ${transfer.bankName}: ${transfer.bankAccountNo}, ${money(transfer.amount)}`}/><a className="table-action" href={qrImage} download={`VietQR-${id}.svg`}>Lưu mã QR</a></> : <p>Chuyển khoản theo thông tin bên dưới.</p>}</div>
            <div className="payment-bank-fields">
              <p><span>Ngân hàng</span><b>{transfer.bankName} · {transfer.bankBranch}</b></p>
              <p><span>Chủ tài khoản</span><b>{transfer.bankAccountName}</b></p>
              <p><span>Số tài khoản</span><b>{transfer.bankAccountNo}</b><button onClick={() => copyText(transfer.bankAccountNo)} aria-label="Sao chép số tài khoản"><ClipboardCopy size={15}/></button></p>
              <p><span>Số tiền</span><b>{money(transfer.amount)}</b><button onClick={() => copyText(transfer.amount)} aria-label="Sao chép số tiền"><ClipboardCopy size={15}/></button></p>
              <p><span>Nội dung chuyển khoản</span><b>{transfer.content}</b><button onClick={() => copyText(transfer.content)} aria-label="Sao chép nội dung"><ClipboardCopy size={15}/></button></p>
            </div>
            <p className="payment-notice">Chuyển đúng số tiền và nội dung. Thu ngân sẽ đối chiếu tiền thực nhận để xác nhận thanh toán.</p>
            {quote.transferReport && <div className="payment-pending"><b>Khách đã báo chuyển khoản — đang chờ đối chiếu</b><p>{new Date(quote.transferReport.reportedAt).toLocaleString('vi-VN')}{quote.transferReport.reference && ` · Mã khách cung cấp: ${quote.transferReport.reference}`}</p></div>}
            {readOnly ? !quote.transferReport && <><label>Mã giao dịch đã chuyển (không bắt buộc)<input maxLength={100} value={customerReference} onChange={e => setCustomerReference(e.target.value)} placeholder="Mã giao dịch từ ứng dụng ngân hàng"/></label>
              <button className="order-button" disabled={busy} onClick={reportTransfer}><Send size={16}/>{busy ? 'Đang gửi...' : 'Tôi đã chuyển khoản — báo thu ngân'}</button></> : <>
              <label>Mã giao dịch thực nhận trên tài khoản ngân hàng<input maxLength={100} minLength={3} placeholder="Nhập mã sau khi đã kiểm tra nhận tiền" value={bankTransactionRef} onChange={e => setBankTransactionRef(e.target.value)}/></label>
              <label className="payment-verified"><input type="checkbox" checked={bankVerified} onChange={e => setBankVerified(e.target.checked)}/>Tôi đã đối chiếu đúng số tiền, nội dung và xác nhận tiền đã về tài khoản.</label>
            </>}
          </div>}
          {!readOnly && <div className="payment-confirm">
            {!quote.allServed && scope === 'session' && <p className="payment-error">Cần hoàn tất phục vụ các món trước khi thu tiền bàn.</p>}
            {tableHeld && <label className="payment-verified"><input type="checkbox" checked={takeOver} onChange={e => setTakeOver(e.target.checked)}/>Tiếp nhận bàn từ {quote.tableLock.ownerName} để thu tiền. Nhân viên sẽ dừng chỉnh món trên bàn này.</label>}
            <button type="button" className="order-button" onClick={confirm} disabled={busy || !canConfirm}>{busy ? 'Đang xác nhận...' : method === 'cash' ? 'Xác nhận đã nhận tiền mặt' : 'Xác nhận đã nhận chuyển khoản'}</button>
          </div>}
          {readOnly && <p className="payment-notice">Trạng thái được cập nhật tự động mỗi 8 giây khi thu ngân xác nhận.</p>}
        </>}
        <button type="button" className="secondary-button" onClick={() => { setError(''); load().catch(e => setError(e.message)); }} disabled={busy}><RefreshCw size={14}/>Kiểm tra lại hóa đơn</button>
      </>}
    </section>
  </div>;
}
