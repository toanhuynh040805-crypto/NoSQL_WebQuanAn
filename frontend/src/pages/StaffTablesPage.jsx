import {
  CheckCircle2, ChefHat, CreditCard, LockKeyhole, Minus, Plus,
  RefreshCw, Search, Table2, UnlockKeyhole, UsersRound
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { api, money } from '../lib/api.js';
import PaymentDialog from '../components/PaymentDialog.jsx';

const statusText = {
  available: 'Trống', reserved: 'Đã đặt', occupied: 'Đang phục vụ',
  cleaning: 'Đang dọn', inactive: 'Ngừng sử dụng'
};
const orderText = {
  pending: 'Chờ xác nhận', confirmed: 'Bếp chưa nhận', preparing: 'Đang chế biến',
  ready: 'Chờ phục vụ', completed: 'Đã phục vụ', cancelled: 'Đã hủy'
};

export default function StaffTablesPage() {
  const { user, authReady, notify } = useApp();
  const permitted = ['admin', 'staff', 'cashier'].includes(user?.role);
  const canServe = ['admin', 'staff'].includes(user?.role);
  const canCashier = ['admin', 'cashier'].includes(user?.role);
  const [tables, setTables] = useState([]);
  const [foods, setFoods] = useState([]);
  const [areas, setAreas] = useState('all');
  const [chosenId, setChosenId] = useState(null);
  const [destinationId, setDestinationId] = useState('');
  const [sessionData, setSessionData] = useState(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [draft, setDraft] = useState({});
  const [priority, setPriority] = useState('normal');
  const [guestCount, setGuestCount] = useState(2);
  const [receiveReservation, setReceiveReservation] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const requestIdRef = useRef(null);

  const loadTables = useCallback(async () => {
    const data = await api('/api/staff/tables');
    setTables(data.tables);
  }, []);
  const loadSession = useCallback(async id => {
    const data = await api('/api/staff/sessions/' + id);
    setSessionData(data);
  }, []);
  useEffect(() => {
    if (!permitted) return;
    loadTables().catch(err => setError(err.message));
    api('/api/foods?limit=50').then(data => setFoods(data.foods)).catch(err => setError(err.message));
  }, [permitted, loadTables]);
  useEffect(() => {
    if (!permitted) return;
    const interval = setInterval(() => {
      loadTables().catch(() => {});
      if (sessionData?.session?._id) loadSession(sessionData.session._id).catch(() => setSessionData(null));
    }, 12000);
    return () => clearInterval(interval);
  }, [permitted, sessionData?.session?._id, loadTables, loadSession]);

  const selected = tables.find(table => table._id === chosenId);
  const activeSessionId = selected?.activeSession?._id;
  useEffect(() => {
    if (!chosenId || !activeSessionId) {
      setSessionData(null);
      return;
    }
    loadSession(activeSessionId).catch(err => setError(err.message));
  }, [chosenId, activeSessionId, loadSession]);

  const choose = table => {
    setChosenId(table._id);
    setPaymentOpen(false);
    setDestinationId('');
    setDraft({});
    setError('');
    setSearch('');
    setCategory('all');
    requestIdRef.current = null;
    const due = table.nextReservation && Math.abs(new Date(table.nextReservation.reservedAt).getTime() - Date.now()) <= 30 * 60 * 1000;
    setReceiveReservation(Boolean(due));
    setGuestCount(due ? table.nextReservation.guestCount : Math.min(2, table.capacity));
    setCustomerName(due ? table.nextReservation.customerName : '');
  };

  const runAction = async (task, success) => {
    setBusy(true);
    setError('');
    try {
      await task();
      if (success) notify(success);
      await loadTables();
      if (sessionData?.session?._id) {
        await loadSession(sessionData.session._id).catch(() => setSessionData(null));
      }
    } catch (err) {
      setError(err.message);
      notify(err.message);
    } finally {
      setBusy(false);
    }
  };

  const openTable = () => runAction(async () => {
    const data = await api('/api/staff/tables/' + chosenId + '/open', {
      method: 'POST', body: JSON.stringify({
        guestCount: Number(guestCount), customerName,
        reservationId: receiveReservation ? selected.nextReservation?._id : undefined
      })
    });
    setSessionData(null);
    await loadSession(data.session._id);
  }, 'Đã nhận bàn và giữ quyền gọi món');

  const getLock = () => runAction(async () => {
    await api('/api/staff/sessions/' + activeSessionId + '/lock', { method: 'POST' });
    await loadSession(activeSessionId);
  }, 'Đã giữ quyền thao tác bàn trong 5 phút');

  const unlock = () => runAction(async () => {
    await api('/api/staff/sessions/' + activeSessionId + '/lock', { method: 'DELETE' });
    await loadSession(activeSessionId);
  }, 'Đã trả quyền thao tác bàn');

  const updateDraft = (foodId, diff) => {
    requestIdRef.current = null;
    setDraft(current => {
      const next = { ...current };
      const count = Math.max(0, Math.min(99, (next[foodId]?.quantity || 0) + diff));
      if (count === 0) delete next[foodId];
      else next[foodId] = { quantity: count, note: next[foodId]?.note || '' };
      return next;
    });
  };
  const updateNote = (foodId, note) => {
    requestIdRef.current = null;
    setDraft(current => ({ ...current, [foodId]: { ...current[foodId], note } }));
  };

  const submit = () => runAction(async () => {
    const items = Object.entries(draft).map(([foodId, item]) => ({
      foodId, quantity: item.quantity, note: item.note || ''
    }));
    if (!items.length) throw new Error('Hãy chọn món trước khi gửi bếp');
    if (!requestIdRef.current) requestIdRef.current = crypto.randomUUID();
    await api('/api/staff/sessions/' + activeSessionId + '/orders', {
      method: 'POST', body: JSON.stringify({ items, priority, clientRequestId: requestIdRef.current })
    });
    setDraft({});
    setPriority('normal');
    requestIdRef.current = null;
    await loadSession(activeSessionId);
  }, 'Đã gửi món sang bếp');

  const changeQuantity = (orderId, index, quantity) => runAction(async () => {
    await api('/api/staff/orders/' + orderId + '/items/' + index, {
      method: 'PATCH', body: JSON.stringify({ quantity })
    });
  }, 'Đã chỉnh số lượng món trước khi bếp chế biến');

  const updateOrder = (orderId, status) => runAction(async () => {
    await api('/api/orders/' + orderId + '/status', {
      method: 'PATCH', body: JSON.stringify({ status })
    });
  }, 'Đã cập nhật trạng thái phục vụ');


  const transferTable = () => runAction(async () => {
    if (!destinationId) throw new Error('Hãy chọn bàn muốn chuyển đến');
    await api('/api/staff/sessions/' + activeSessionId + '/transfer', {
      method: 'PATCH', body: JSON.stringify({ destinationTableId: destinationId })
    });
    setChosenId(destinationId);
    setDestinationId('');
    setDraft({});
  }, 'Đã chuyển bàn cùng toàn bộ lịch sử món');

  const closeTable = () => {
    if (!window.confirm('Kết thúc phiên và trả bàn sau khi tất cả món đã phục vụ, thanh toán?')) return;
    return runAction(async () => {
    await api('/api/staff/sessions/' + activeSessionId + '/close', { method: 'PATCH' });
    setSessionData(null);
    setChosenId(null);
    setDraft({});
    }, 'Đã kết thúc phiên phục vụ và cập nhật bàn');
  };

  const areaNames = [...new Set(tables.map(t => t.area))];
  const visibleTables = tables.filter(table => areas === 'all' || table.area === areas);
  const filteredFoods = foods.filter(food =>
    (category === 'all' || food.category?._id === category)
    && food.name.toLowerCase().includes(search.trim().toLowerCase())
  );
  const categories = [...new Map(foods.filter(f => f.category).map(f => [
    f.category._id, { id: f.category._id, name: f.category.name }
  ])).values()];
  const draftCount = Object.values(draft).reduce((sum, item) => sum + item.quantity, 0);
  const draftTotal = Object.entries(draft).reduce((sum, [id, item]) => {
    const food = foods.find(f => f._id === id);
    return sum + (food?.price || 0) * item.quantity;
  }, 0);
  const lock = sessionData?.lock;
  const isOwner = Boolean(lock && String(lock.ownerId) === String(user?.id));
  const orders = sessionData?.orders || [];
  const payable = orders.filter(o => o.status !== 'cancelled');
  const canClose = payable.every(o => o.status === 'completed' && o.paymentStatus === 'paid');
  if (!authReady) {
    return <div className="page"><div className="empty">Đang xác thực tài khoản nhân viên...</div></div>;
  }
  if (!permitted) return <Navigate to="/login" replace />;

  return <section className="staff-workspace">
    <header className="staff-workspace-head">
      <div><span className="eyebrow">VẬN HÀNH QUÁN · KLCN</span><h1><Table2 size={30}/> Sơ đồ bàn & gọi món</h1>
        <p>Chọn khu vực, nhận bàn, gọi món trực tiếp và theo dõi chế biến – thanh toán.</p></div>
      <button className="secondary-button" onClick={() => runAction(loadTables, 'Đã cập nhật sơ đồ bàn')} disabled={busy}><RefreshCw size={16}/> Làm mới</button>
    </header>
    {error && <div className="staff-error">{error}</div>}
    <div className="staff-layout">
      <section className="staff-tables">
        <div className="staff-section-head"><h2>Sơ đồ bàn</h2><span>{tables.length} bàn</span></div>
        <div className="staff-area-filter"><button className={areas === 'all' ? 'active' : ''} onClick={() => setAreas('all')}>Tất cả khu</button>
          {areaNames.map(a => <button className={areas === a ? 'active' : ''} onClick={() => setAreas(a)} key={a}>{a}</button>)}</div>
        <div className="staff-legend"><span><i className="dot available"/> Trống</span><span><i className="dot reserved"/> Đã đặt</span><span><i className="dot occupied"/> Đang phục vụ</span></div>
        <div className="staff-table-grid">
          {visibleTables.map(table => <button type="button" key={table._id}
            className={'staff-table-tile ' + table.status + (chosenId === table._id ? ' selected' : '')}
            onClick={() => choose(table)}>
            <Table2 size={26}/><strong>{table.name}</strong><small>{table.capacity} chỗ · {table.area}</small>
            <span>{statusText[table.status] || table.status}</span>
            {table.activeSession && <em>{table.activeSession.guestCount} khách đang ngồi</em>}
            {!table.activeSession && table.nextReservation && <em>Đặt: {new Date(table.nextReservation.reservedAt).toLocaleString('vi-VN')}</em>}
          </button>)}
        </div>
      </section>
      <section className="staff-order-panel">
        {!selected ? <div className="staff-panel-empty"><Table2 size={55}/><h2>Chọn một bàn để bắt đầu</h2><p>Mỗi bàn có phiên phục vụ riêng, lịch sử món và thanh toán.</p></div> : <>
          <div className="staff-section-head"><div><span className="eyebrow">{selected.area}</span><h2>{selected.name} · {statusText[selected.status]}</h2></div>
            <button className="secondary-button" onClick={() => {setChosenId(null);setSessionData(null);}}>Đóng</button></div>
          {!selected.activeSession ? (
            <div className="staff-intake">
              {['available', 'reserved'].includes(selected.status) && canServe ? <>
                <h3>{receiveReservation ? 'Nhận bàn đặt trước' : 'Nhận bàn thường'}</h3>
                {selected.nextReservation && <>
                  <p>Lịch đặt: {selected.nextReservation.reservationCode} · {new Date(selected.nextReservation.reservedAt).toLocaleString('vi-VN')}</p>
                  <label className="staff-priority"><input type="checkbox" checked={receiveReservation}
                    onChange={e => {
                      setReceiveReservation(e.target.checked);
                      if (e.target.checked) {
                        setGuestCount(selected.nextReservation.guestCount);
                        setCustomerName(selected.nextReservation.customerName);
                      }
                    }}/> Nhận khách theo lịch đặt này (chỉ trong vòng 30 phút quanh giờ hẹn)</label>
                </>}
                <label><UsersRound size={16}/> Số khách<input type="number" min="1" max={selected.capacity} value={guestCount} onChange={e => setGuestCount(e.target.value)}/></label>
                <label>Tên khách / thành viên<input maxLength="100" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Không bắt buộc"/></label>
                <button className="order-button" disabled={busy || !guestCount || Number(guestCount) > selected.capacity || (selected.status === 'reserved' && !receiveReservation)} onClick={openTable}>Nhận bàn và bắt đầu gọi món</button>
              </> : <p>Bàn chưa có phiên gọi món dành cho nhân viên. Nếu có đơn từ luồng web trước đó, hãy kiểm tra ở mục Đơn hàng; chỉ nhận bàn mới sau khi bàn được giải phóng.</p>}
            </div>
          ) : !sessionData || String(sessionData.session?._id) !== String(activeSessionId)
            ? <div className="empty">Đang tải phiên bàn...</div>
            : <>
              <div className="staff-session-meta">
                <span><UsersRound size={16}/> {sessionData.session.guestCount} khách</span>
                <span>{sessionData.session.customerName || 'Khách tại bàn'}</span>
                <span>Đã gọi {orders.length} lượt</span>
              </div>
              <div className="staff-lock">
                {sessionData.session.paymentState === 'paid' ? <span><CheckCircle2 size={17}/> Phiên bàn đã thanh toán</span> : lock ? <span><LockKeyhole size={17}/> {isOwner ? 'Bạn đang giữ quyền thao tác' : lock.ownerName + ' đang thao tác'} ({Math.ceil(lock.secondsLeft / 60)} phút)</span>
                  : <span><UnlockKeyhole size={17}/> Chưa có người giữ quyền gọi món</span>}
                {canServe && sessionData.session.paymentState !== 'paid' && (isOwner ? <div><button onClick={getLock} disabled={busy}>Gia hạn</button><button onClick={unlock} disabled={busy}>Trả quyền</button></div>
                  : !lock && <button onClick={getLock} disabled={busy}>Giữ quyền 5 phút</button>)}
              </div>
              <div className="staff-section-head"><h3>Đơn món tại bàn</h3><strong>{money(sessionData.subtotal || 0)}</strong></div>
              <div className="staff-order-list">{orders.length ? orders.map(order => <article key={order._id} className="staff-order-ticket">
                <div className="staff-ticket-head"><b>{order.orderCode}</b><small>{new Date(order.createdAt).toLocaleTimeString('vi-VN')}</small></div>
                <span className={'staff-state ' + order.status}>{orderText[order.status] || order.status}</span>
                <ul>{order.items.map((item, index) => <li key={index} className="staff-existing-item">
                  <span>{item.quantity}× {item.name}{item.note && <em> · {item.note}</em>}</span>
                  {order.status === 'confirmed' && canServe && isOwner && sessionData.session.paymentState !== 'paid' && <span className="staff-item-edit">
                    <button title="Giảm số lượng (0 = hủy món)" disabled={busy} onClick={() => changeQuantity(order._id, index, item.quantity - 1)}><Minus size={12}/></button>
                    <button title="Tăng số lượng" disabled={busy || item.quantity >= 99} onClick={() => changeQuantity(order._id, index, item.quantity + 1)}><Plus size={12}/></button>
                  </span>}
                </li>)}</ul>
                <div className="staff-ticket-bottom"><b>{money(order.totalAmount)}</b><span>{order.paymentStatus === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán'}</span></div>
                <div className="staff-ticket-actions">
                  {order.status === 'ready' && canServe && <button onClick={() => updateOrder(order._id, 'completed')} disabled={busy}><CheckCircle2 size={15}/> Đã phục vụ</button>}

                </div>
              </article>) : <p className="staff-muted">Bàn chưa gọi món.</p>}</div>
              {canServe && isOwner && sessionData.session.paymentState !== 'paid' && <div className="staff-transfer">
                <h3>Chuyển bàn</h3><p>Chuyển toàn bộ lượt món và phiên phục vụ sang bàn trống phù hợp.</p>
                <div><select value={destinationId} onChange={e => setDestinationId(e.target.value)}>
                  <option value="">Chọn bàn đích</option>
                  {tables.filter(t => t._id !== selected._id && t.status === 'available' && t.capacity >= sessionData.session.guestCount)
                    .map(t => <option key={t._id} value={t._id}>{t.name} · {t.area} · {t.capacity} chỗ</option>)}
                </select>
                <button onClick={transferTable} disabled={busy || !destinationId || Boolean(sessionData.session.reservation)}>Chuyển bàn</button></div>
                {sessionData.session.reservation && <small>Bàn thuộc lịch đặt đã nhận: không tự chuyển để tránh sai thông tin đặt bàn.</small>}
              </div>}
              {canCashier && <div className="staff-close">
                <p>{canClose ? 'Đã hoàn tất phục vụ và thanh toán các đơn.' : 'Chưa thể trả bàn: còn đơn chưa phục vụ hoặc chưa thanh toán.'}</p>
                {payable.some(o => o.paymentStatus !== 'paid') && <button type="button" className="order-button" onClick={() => setPaymentOpen(true)} disabled={busy}>
                  <CreditCard size={16}/> Thu tiền toàn bộ hóa đơn · {money(payable.filter(o => o.paymentStatus !== 'paid').reduce((sum,o) => sum + o.totalAmount, 0))}
                </button>}
                {sessionData.session.paymentReceipt && <button className="secondary-button" onClick={() => setPaymentOpen(true)}>Xem phiếu thu đã thanh toán</button>}
                <button className="order-button" onClick={closeTable} disabled={busy || !canClose}>Kết thúc phiên & trả bàn</button>
              </div>}
              {canServe && sessionData.session.paymentState !== 'paid' && <>
                <div className="staff-section-head"><h3><ChefHat size={18}/> Gọi thêm món</h3><span>{draftCount} món đang chọn</span></div>
                <div className="staff-menu-search"><Search size={17}/><input placeholder="Tìm món trong thực đơn KLCN..." value={search} onChange={e => setSearch(e.target.value)}/></div>
                <div className="staff-category-filter"><button className={category === 'all' ? 'active' : ''} onClick={() => setCategory('all')}>Tất cả</button>
                  {categories.map(c => <button key={c.id} className={category === c.id ? 'active' : ''} onClick={() => setCategory(c.id)}>{c.name}</button>)}</div>
                {foods.length === 0 && <p className="staff-error">Thực đơn chưa có dữ liệu. Quản trị viên cần chạy npm run restore:menu rồi mở lại trang.</p>}
                <div className="staff-menu-grid">{filteredFoods.map(food => <article key={food._id} className="staff-menu-food">
                  <img src={food.imageUrl || '/placeholder-food.svg'} alt={food.name} loading="lazy"/>
                  <div><h4>{food.name}</h4><strong>{money(food.price)}</strong>
                    <div className="staff-qty"><button onClick={() => updateDraft(food._id, -1)} disabled={!draft[food._id]}><Minus size={14}/></button><b>{draft[food._id]?.quantity || 0}</b><button onClick={() => updateDraft(food._id, 1)}><Plus size={14}/></button></div>
                    {draft[food._id] && <input maxLength="200" placeholder="Ghi chú món: ít cay..." value={draft[food._id].note} onChange={e => updateNote(food._id, e.target.value)}/>}</div>
                </article>)}</div>
                <label className="staff-priority"><input type="checkbox" checked={priority === 'urgent'} onChange={e => { setPriority(e.target.checked ? 'urgent' : 'normal'); requestIdRef.current = null; }}/> Ưu tiên chế biến lượt gọi món này</label>
                <div className="staff-submit"><span>{draftCount} món · <b>{money(draftTotal)}</b></span>
                  <button className="order-button" onClick={submit} disabled={busy || !isOwner || !draftCount}>{busy ? 'Đang xử lý...' : 'Gửi món sang bếp'}</button></div>
              </>}
            </>}
        </>}
      </section>
    </div>
    {paymentOpen && activeSessionId && <PaymentDialog scope="session" id={activeSessionId}
      onClose={() => setPaymentOpen(false)}
      onPaid={async () => {
        await loadSession(activeSessionId);
        await loadTables();
        notify('Đã lập phiếu thu và ghi nhận thanh toán cho bàn');
      }}/>}
  </section>;
}
