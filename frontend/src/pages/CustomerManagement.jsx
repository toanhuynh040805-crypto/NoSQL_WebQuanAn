import { useCallback, useEffect, useState } from 'react';
import { Download, Search, UserPlus, UsersRound, X } from 'lucide-react';
import { api, money } from '../lib/api.js';
import { useApp } from '../context/AppContext.jsx';

const blank = { fullName: '', email: '', phone: '', address: '', customerNotes: '', password: '' };
const statusNames = { pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận', preparing: 'Đang chế biến', ready: 'Sẵn sàng', completed: 'Hoàn thành', cancelled: 'Đã hủy', seated: 'Đã nhận bàn', 'no-show': 'Không đến' };
const date = value => value ? new Date(value).toLocaleString('vi-VN') : 'Chưa có';
const csvCell = value => '"' + String(value ?? '').replace(/^[=+@\-\t\r]/, "'$&").replaceAll('"', '""') + '"';

export default function CustomerManagement({ user }) {
  const { notify } = useApp();
  const [data, setData] = useState(null);
  const [search, setSearch] = useState('');
  const [state, setState] = useState('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank);
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);
  const canWrite = ['admin', 'cashier'].includes(user.role);
  const load = useCallback(async signal => {
    const query = new URLSearchParams({ search, state, page: String(page), limit: '12' });
    const result = await api('/api/customers?' + query, { signal });
    setData(result);
  }, [search, state, page]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    const timer = setTimeout(() => load(controller.signal).catch(e => {
      if (e.name !== 'AbortError') setError(e.message);
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); }), 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [load]);
  const openDetail = async id => {
    setBusy(true);
    try { setDetail(await api('/api/customers/' + id)); }
    catch (e) { notify(e.message); }
    finally { setBusy(false); }
  };
  const startEdit = customer => {
    setEditing(customer?._id || 'new');
    setForm(customer ? { ...blank, ...Object.fromEntries(Object.keys(blank).map(key => [key, customer[key] || ''])) } : { ...blank });
    setDetail(null); setError('');
  };
  const save = async event => {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError('');
    try {
      const { password, ...profile } = form;
      await api('/api/customers' + (editing === 'new' ? '' : '/' + editing), {
        method: editing === 'new' ? 'POST' : 'PATCH', body: JSON.stringify(editing === 'new' ? { ...profile, password } : profile)
      });
      setEditing(null); await load(); notify(editing === 'new' ? 'Đã thêm khách hàng' : 'Đã cập nhật hồ sơ khách hàng');
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  const toggle = async customer => {
    if (!window.confirm(`${customer.isActive ? 'Khóa' : 'Mở khóa'} tài khoản ${customer.fullName}? Lịch sử giao dịch được giữ lại.`)) return;
    setBusy(true);
    try {
      await api('/api/customers/' + customer._id, { method: 'PATCH', body: JSON.stringify({ isActive: !customer.isActive }) });
      await load(); if (detail?.customer._id === customer._id) await openDetail(customer._id);
      notify('Đã cập nhật trạng thái tài khoản');
    } catch (e) { notify(e.message); }
    finally { setBusy(false); }
  };
  const exportCsv = () => {
    const rows = [['Họ tên', 'Email', 'Số điện thoại', 'Địa chỉ', 'Trạng thái', 'Điểm', 'Số đơn', 'Đã chi tiêu (VNĐ)', 'Chưa thanh toán (VNĐ)'],
      ...(data?.customers || []).map(c => [c.fullName, c.email, c.phone, c.address, c.isActive ? 'Hoạt động' : 'Đã khóa', c.loyaltyPoints, c.stats.orderCount, c.stats.totalSpent, c.stats.unpaidAmount])];
    const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `KhachHang_Trang${page}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <div className="customers-page">
    <div className="stat-grid operations-stats"><div><UsersRound/><span>Tổng khách hàng</span><strong>{data?.summary.total || 0}</strong></div><div><UsersRound/><span>Đang hoạt động</span><strong>{data?.summary.active || 0}</strong></div><div><UsersRound/><span>Đã khóa</span><strong>{data?.summary.inactive || 0}</strong></div></div>
    <div className="customer-toolbar"><label className="customer-search"><Search size={18}/><input aria-label="Tìm khách hàng" placeholder="Tìm tên, số điện thoại, email..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}/></label>
      <select aria-label="Trạng thái tài khoản" value={state} onChange={e => { setState(e.target.value); setPage(1); }}><option value="all">Tất cả trạng thái</option><option value="active">Hoạt động</option><option value="inactive">Đã khóa</option></select>
      <button className="secondary-button" onClick={exportCsv} disabled={!data?.customers.length || loading}><Download size={16}/>Xuất trang CSV</button>
      {canWrite && <button className="primary-button compact-button" onClick={() => startEdit(null)}><UserPlus size={17}/>Thêm khách hàng</button>}
    </div>
    {error && <p className="payment-error" role="alert">{error}</p>}
    {editing && <form className="panel-form customer-form" onSubmit={save}><div className="customer-detail-heading"><h2>{editing === 'new' ? 'Thêm khách hàng' : 'Sửa hồ sơ khách hàng'}</h2><button className="secondary-button" type="button" onClick={() => setEditing(null)} aria-label="Đóng biểu mẫu"><X size={18}/></button></div>
      <div className="customer-form-grid">{[['fullName', 'Họ và tên', 'text', 100], ['email', 'Email đăng nhập', 'email', 150], ['phone', 'Số điện thoại', 'tel', 20], ['address', 'Địa chỉ', 'text', 300]].map(([key, label, type, max]) => <label key={key}>{label}<input required={['fullName','email'].includes(key)} minLength={key === 'fullName' ? 2 : undefined} type={type} maxLength={max} value={form[key]} onChange={e => setForm(current => ({ ...current, [key]: e.target.value }))}/></label>)}</div>
      {editing === 'new' && <label>Mật khẩu ban đầu<input required minLength={6} maxLength={72} type="password" autoComplete="new-password" value={form.password} onChange={e => setForm(current => ({ ...current, password: e.target.value }))}/></label>}
      <label>Ghi chú chăm sóc khách hàng<textarea maxLength={1000} value={form.customerNotes} onChange={e => setForm(current => ({ ...current, customerNotes: e.target.value }))} placeholder="Sở thích, yêu cầu đặc biệt..."/></label>
      <button className="primary-button compact-button" type="submit" disabled={busy}>{busy ? 'Đang lưu...' : 'Lưu khách hàng'}</button>
    </form>}
    {loading ? <div className="empty">Đang tải khách hàng...</div> : !data?.customers.length ? <div className="empty">Không tìm thấy khách hàng phù hợp.</div> : <div className="admin-table-wrap customer-table"><table><thead><tr><th>Khách hàng</th><th>Liên hệ</th><th>Đơn hàng / Điểm</th><th>Đã chi tiêu</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{data.customers.map(customer => <tr key={customer._id}>
      <td><b>{customer.fullName}</b><small>Tham gia {new Date(customer.createdAt).toLocaleDateString('vi-VN')}</small></td><td>{customer.phone || 'Chưa có SĐT'}<small>{customer.email}</small></td>
      <td>{customer.stats.orderCount} đơn<small>{customer.loyaltyPoints || 0} điểm</small></td><td><b>{money(customer.stats.totalSpent)}</b>{customer.stats.unpaidAmount > 0 && <small>Chưa thu: {money(customer.stats.unpaidAmount)}</small>}</td>
      <td><span className={`customer-badge ${customer.isActive ? 'active' : ''}`}>{customer.isActive ? 'Hoạt động' : 'Đã khóa'}</span></td><td><button className="table-action" disabled={busy} onClick={() => openDetail(customer._id)}>Xem hồ sơ</button>{user.role === 'admin' && <button className="table-action" disabled={busy} onClick={() => toggle(customer)}>{customer.isActive ? 'Khóa' : 'Mở khóa'}</button>}</td>
    </tr>)}</tbody></table></div>}
    <div className="customer-pagination"><span>{data?.pagination.total || 0} khách hàng phù hợp · Trang {page}/{Math.max(1, data?.pagination.pages || 1)}</span><div><button className="secondary-button" disabled={loading || page <= 1} onClick={() => setPage(page - 1)}>Trước</button><button className="secondary-button" disabled={loading || page >= (data?.pagination.pages || 1)} onClick={() => setPage(page + 1)}>Sau</button></div></div>
    {detail && <div className="payment-modal-backdrop" onClick={() => setDetail(null)} role="presentation"><section className="payment-modal customer-detail" role="dialog" aria-modal="true" aria-label="Hồ sơ khách hàng" onClick={e => e.stopPropagation()}>
      <div className="customer-detail-heading"><div><span className="eyebrow">HỒ SƠ KHÁCH HÀNG</span><h2>{detail.customer.fullName}</h2></div><button className="secondary-button" onClick={() => setDetail(null)} aria-label="Đóng hồ sơ"><X size={18}/></button></div>
      <p>{detail.customer.email} · {detail.customer.phone || 'Chưa có SĐT'}</p><p>{detail.customer.address || 'Chưa cập nhật địa chỉ'}</p>
      <div className="customer-metrics"><div><span>Đã chi tiêu</span><b>{money(detail.stats.totalSpent)}</b></div><div><span>Điểm tích lũy</span><b>{detail.customer.loyaltyPoints || 0}</b></div><div><span>Đơn đã trả tiền</span><b>{detail.stats.paidOrders}/{detail.stats.orderCount}</b></div><div><span>Chưa thu</span><b>{money(detail.stats.unpaidAmount)}</b></div></div>
      {detail.customer.customerNotes && <p className="payment-notice"><b>Ghi chú:</b> {detail.customer.customerNotes}</p>}
      {canWrite && <button className="secondary-button" onClick={() => startEdit(detail.customer)}>Sửa hồ sơ</button>}
      <h3>Món thường gọi</h3><p>{detail.favoriteFoods.length ? detail.favoriteFoods.map(food => `${food.name} (${food.quantity})`).join(' · ') : 'Chưa có đơn đã thanh toán'}</p>
      <h3>Lịch sử đơn hàng <small>(30 đơn gần nhất)</small></h3><div className="customer-history">{detail.orders.length ? detail.orders.map(order => <article key={order._id}><div><b>{order.orderCode}</b><small>{date(order.createdAt)} · {statusNames[order.status]}</small><p>{order.items.map(item => `${item.quantity} × ${item.name}`).join(', ')}</p></div><div><b>{money(order.totalAmount)}</b><small>{order.paymentStatus === 'paid' ? 'Đã thanh toán' : order.paymentStatus === 'refunded' ? 'Đã hoàn tiền' : 'Chưa thanh toán'}</small></div></article>) : <p>Khách chưa có đơn hàng.</p>}</div>
      <h3>Lịch sử đặt bàn <small>(20 lịch gần nhất)</small></h3><div className="customer-history">{detail.reservations.length ? detail.reservations.map(item => <article key={item._id}><div><b>{item.reservationCode}</b><small>{date(item.reservedAt)} · {item.guestCount} khách · {item.table?.name || 'Chưa xếp bàn'}</small></div><span>{statusNames[item.status]}</span></article>) : <p>Khách chưa đặt bàn.</p>}</div>
    </section></div>}
  </div>;
}
