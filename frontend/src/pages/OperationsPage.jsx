import { BarChart3, CalendarDays, ClipboardList, LayoutDashboard, PackageOpen, Percent, Table2, Tags, Utensils, UsersRound, Database, HardDrive, Network } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { api, money } from '../lib/api.js';
import PaymentDialog from '../components/PaymentDialog.jsx';
import CustomerManagement from './CustomerManagement.jsx';

const orderLabels = { pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận', preparing: 'Đang chế biến', ready: 'Sẵn sàng', completed: 'Hoàn thành', cancelled: 'Đã hủy' };
const reservationLabels = { pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận', seated: 'Đã nhận bàn', completed: 'Hoàn thành', cancelled: 'Đã hủy', 'no-show': 'Không đến' };
const tableLabels = { available: 'Trống', occupied: 'Đang phục vụ', reserved: 'Đã đặt', cleaning: 'Đang dọn', inactive: 'Ngừng sử dụng' };
const roleLabels = { customer: 'Khách hàng', admin: 'Quản trị', staff: 'Phục vụ', kitchen: 'Bếp', cashier: 'Thu ngân' };

const tabConfig = [
  ['overview', 'Tổng quan', LayoutDashboard, ['admin', 'staff', 'cashier']],
  ['orders', 'Đơn hàng', ClipboardList, ['admin', 'staff', 'cashier']],
  ['reservations', 'Đặt bàn', CalendarDays, ['admin', 'staff']],
  ['tables', 'Sơ đồ bàn', Table2, ['admin', 'staff']],
  ['inventory', 'Kho nguyên liệu', PackageOpen, ['admin', 'staff']],
  ['menu', 'Thực đơn', Utensils, ['admin']],
  ['categories', 'Danh mục', Tags, ['admin']],
  ['users', 'Người dùng', UsersRound, ['admin']],
  ['customers', 'Khách hàng', UsersRound, ['admin', 'staff', 'cashier']],
  ['promotions', 'Khuyến mãi', Percent, ['admin']],
  ['reports', 'Báo cáo', BarChart3, ['admin', 'cashier']],
  ['nosql', 'CSDL NoSQL', Database, ['admin']]
];

export default function OperationsPage() {
  const { user, authReady, notify } = useApp();
  const [params, setParams] = useSearchParams();
  const allowedTabs = useMemo(() => tabConfig.filter(tab => tab[3].includes(user?.role)), [user]);
  const requestedTab = params.get('tab');
  const activeTab = allowedTabs.some(tab => tab[0] === requestedTab) ? requestedTab : allowedTabs[0]?.[0];
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const permitted = user && ['admin', 'staff', 'cashier'].includes(user.role);

  const load = async () => {
    if (!permitted || !activeTab) return;
    setLoading(true);
    try {
      if (activeTab === 'overview') setData(await api('/api/admin/dashboard'));
      if (activeTab === 'orders') setData(await api('/api/admin/orders'));
      if (activeTab === 'reservations') {
        const [reservations, tables] = await Promise.all([api('/api/reservations'), api('/api/tables?all=true')]);
        setData({ ...reservations, ...tables });
      }
      if (activeTab === 'tables') setData(await api('/api/tables?all=true'));
      if (activeTab === 'inventory') setData(await api('/api/inventory'));
      if (activeTab === 'menu') {
        const [foods, categories] = await Promise.all([api('/api/foods?available=all&limit=50'), api('/api/categories')]);
        setData({ ...foods, ...categories });
      }
      if (activeTab === 'categories') setData(await api('/api/categories'));
      if (activeTab === 'users') setData(await api('/api/admin/users'));
      if (activeTab === 'customers') setData({ refreshKey: Date.now() });
      if (activeTab === 'promotions') setData(await api('/api/promotions'));
      if (activeTab === 'reports') setData(await api('/api/admin/reports'));
      if (activeTab === 'nosql') setData(await api('/api/nosql/overview'));
    } catch (error) { notify(error.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [activeTab, user]);
  useEffect(() => {
    if (!permitted || activeTab !== 'orders') return;
    const timer = setInterval(() => api('/api/admin/orders').then(setData).catch(() => {}), 10000);
    return () => clearInterval(timer);
  }, [permitted, activeTab]);
  if (!authReady) return <div className="empty">Đang xác thực...</div>;
  if (!permitted) return <Navigate to="/" replace />;

  const action = async (request, success) => {
    try { await request(); notify(success); await load(); }
    catch (error) { notify(error.message); }
  };

  return <section className="operations-page">
    <aside className="operations-sidebar"><h2>Quản lý quán</h2><span>{roleLabels[user.role]}</span><nav>{allowedTabs.map(([id, label, Icon]) => <button key={id} className={activeTab === id ? 'active' : ''} onClick={() => setParams({ tab: id })}><Icon size={18}/>{label}</button>)}</nav></aside>
    <div className="operations-content"><div className="operations-heading"><div><span className="eyebrow">BẾP NHÀ</span><h1>{allowedTabs.find(tab => tab[0] === activeTab)?.[1]}</h1></div><button className="secondary-button" onClick={load}>Làm mới</button></div>
      {loading ? <div className="empty">Đang tải dữ liệu...</div> : <TabContent tab={activeTab} data={data} user={user} action={action} />}
    </div>
  </section>;
}

function TabContent({ tab, data, user, action }) {
  if (tab === 'overview') return <Overview data={data}/>;
  if (tab === 'orders') return <Orders data={data} user={user} action={action}/>;
  if (tab === 'reservations') return <Reservations data={data} action={action}/>;
  if (tab === 'tables') return <Tables data={data} user={user} action={action}/>;
  if (tab === 'inventory') return <Inventory data={data} user={user} action={action}/>;
  if (tab === 'menu') return <MenuManagement data={data} action={action}/>;
  if (tab === 'categories') return <CategoryManagement data={data} action={action}/>;
  if (tab === 'users') return <Users data={data} action={action}/>;
  if (tab === 'customers') return <CustomerManagement key={data.refreshKey} user={user}/>;
  if (tab === 'promotions') return <Promotions data={data} action={action}/>;
  if (tab === 'reports') return <Reports data={data}/>;
  if (tab === 'nosql') return <NoSQLOverview data={data}/>;
}

function Overview({ data }) {
  const tableMap = Object.fromEntries((data.tables || []).map(item => [item._id, item.count]));
  return <><div className="stat-grid operations-stats"><div><UsersRound/><span>Khách hàng</span><strong>{data.users || 0}</strong></div><div><Utensils/><span>Món ăn</span><strong>{data.foods || 0}</strong></div><div><ClipboardList/><span>Đơn đang xử lý</span><strong>{data.pendingOrders || 0}</strong></div><div><CalendarDays/><span>Lịch đặt sắp tới</span><strong>{data.reservations || 0}</strong></div><div><Table2/><span>Bàn đang phục vụ</span><strong>{tableMap.occupied || 0}</strong></div><div><BarChart3/><span>Doanh thu hôm nay</span><strong>{money(data.today?.revenue || 0)}</strong></div></div></>;
}

function Orders({ data, user, action }) {
  const [paying, setPaying] = useState(null);
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const next = { pending: ['confirmed', 'cancelled'], confirmed: ['preparing', 'cancelled'], preparing: ['ready'], ready: ['completed'], completed: [], cancelled: [] };
  const roleOptions = user.role === 'cashier' ? ['completed', 'cancelled'] : ['confirmed', 'preparing', 'ready', 'completed', 'cancelled'];
  const orders = (data.orders || []).filter(order => {
    const term = search.trim().toLocaleLowerCase('vi-VN');
    return (!term || [order.orderCode, order.customer?.fullName, order.customer?.phone, order.tableNumber].some(value => String(value || '').toLocaleLowerCase('vi-VN').includes(term)))
      && (statusFilter === 'all' || order.status === statusFilter)
      && (paymentFilter === 'all' || (paymentFilter === 'reported' ? order.bankTransferReport?.reportedAt && order.paymentStatus === 'pending' : order.paymentStatus === paymentFilter));
  });
  return <><div className="customer-toolbar"><input className="operations-search" aria-label="Tìm đơn hàng" placeholder="Mã đơn, tên khách, SĐT, bàn..." value={search} onChange={e => setSearch(e.target.value)}/>
    <select aria-label="Lọc trạng thái đơn" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="all">Tất cả đơn hàng</option>{Object.entries(orderLabels).map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select>
    <select aria-label="Lọc thanh toán" value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)}><option value="all">Tất cả thanh toán</option><option value="reported">Khách báo đã chuyển khoản</option><option value="pending">Chưa thanh toán</option><option value="paid">Đã thanh toán</option></select>
    <span>{orders.length} đơn trong 200 đơn gần nhất</span></div>
    <div className="admin-table-wrap"><table><thead><tr><th>Mã đơn</th><th>Khách / Bàn</th><th>Món</th><th>Thanh toán</th><th>Trạng thái</th></tr></thead><tbody>{orders.map(order => <tr key={order._id}>
      <td><b>{order.orderCode}</b><small>{new Date(order.createdAt).toLocaleString('vi-VN')}</small></td><td>{order.customer?.fullName || 'Khách vãng lai'}<small>{order.customer?.phone}</small><small>{order.tableNumber || 'Mang về'}</small></td>
      <td>{order.items.map(item => `${item.quantity} × ${item.name}`).join(', ')}</td>
      <td><b>{money(order.totalAmount ?? order.subtotal)}</b><small>{order.paymentStatus === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán'} · {order.paymentMethod === 'bank-transfer' ? 'Chuyển khoản' : 'Tiền mặt / Quầy'}</small>
        {order.paymentStatus === 'pending' && order.bankTransferReport?.reportedAt && <span className="customer-badge reported">Khách báo đã chuyển khoản</span>}
        {['admin', 'cashier'].includes(user.role) && order.status !== 'cancelled' && <button type="button" className="table-action" onClick={() => setPaying(order)}>{order.paymentStatus === 'paid' ? 'Xem phiếu thu' : order.tableSession ? 'Thu tiền cả bàn' : 'Thu tiền / VietQR'}</button>}
      </td><td><select value={order.status} disabled={!next[order.status]?.some(status => roleOptions.includes(status))} onChange={e => action(() => api(`/api/orders/${order._id}/status`, { method: 'PATCH', body: JSON.stringify({ status: e.target.value }) }), 'Đã cập nhật đơn')}>
        <option value={order.status}>{orderLabels[order.status]}</option>{(next[order.status] || []).filter(status => roleOptions.includes(status) && !(status === 'cancelled' && order.paymentStatus === 'paid')).map(status => <option key={status} value={status}>{orderLabels[status]}</option>)}</select></td>
    </tr>)}{!orders.length && <tr><td colSpan={5}>Không có đơn phù hợp.</td></tr>}</tbody></table></div>
    {paying && <PaymentDialog scope={paying.tableSession ? 'session' : 'order'} id={paying.tableSession || paying._id} suggestedMethod={paying.bankTransferReport?.reportedAt ? 'bank-transfer' : paying.paymentMethod}
      onClose={() => setPaying(null)} onPaid={() => action(() => Promise.resolve(), 'Đã ghi nhận thanh toán')}/>}
  </>;
}


function Reservations({ data, action }) {
  return <div className="admin-table-wrap"><table><thead><tr><th>Mã</th><th>Khách hàng</th><th>Thời gian</th><th>Số khách/Bàn</th><th>Trạng thái</th></tr></thead><tbody>{(data.reservations || []).map(item => <tr key={item._id}><td><b>{item.reservationCode}</b></td><td>{item.customerName}<small>{item.phone}</small></td><td>{new Date(item.reservedAt).toLocaleString('vi-VN')}</td><td>{item.guestCount} khách<select defaultValue={item.table?._id || ''} id={`table-${item._id}`}><option value="">Chưa xếp bàn</option>{(data.tables || []).filter(table => table.capacity >= item.guestCount && table.status !== 'inactive').map(table => <option value={table._id} key={table._id}>{table.name} · {table.capacity} chỗ</option>)}</select></td><td><select value={item.status} onChange={e => { const tableId = document.getElementById(`table-${item._id}`).value || undefined; action(() => api(`/api/reservations/${item._id}/status`, { method: 'PATCH', body: JSON.stringify({ status: e.target.value, tableId }) }), 'Đã cập nhật đặt bàn'); }}><option value="pending" disabled>{reservationLabels.pending}</option><option value="confirmed">{reservationLabels.confirmed}</option><option value="seated" disabled>{reservationLabels.seated} (nhận từ sơ đồ bàn)</option><option value="completed">{reservationLabels.completed}</option><option value="cancelled">{reservationLabels.cancelled}</option><option value="no-show">{reservationLabels['no-show']}</option></select></td></tr>)}</tbody></table></div>;
}

function Tables({ data, user, action }) {
  const add = () => { const name = prompt('Tên bàn (ví dụ T1-A9):'); if (!name) return; const area = prompt('Khu vực:'); const capacity = Number(prompt('Sức chứa:', '4')); action(() => api('/api/tables', { method: 'POST', body: JSON.stringify({ name, area, capacity }) }), 'Đã thêm bàn'); };
  return <><div className="toolbar">{user.role === 'admin' && <button className="primary-button compact-button" onClick={add}>+ Thêm bàn</button>}</div><div className="table-grid">{(data.tables || []).map(table => <article className={`table-card ${table.status}`} key={table._id}><Table2/><h3>{table.name}</h3><p>{table.area} · {table.capacity} chỗ</p><p><b>{tableLabels[table.status]}</b></p><Link className="table-action" to="/staff/tables">Mở sơ đồ bàn và gọi món</Link></article>)}</div></>;
}

function Inventory({ data, user, action }) {
  const add = () => { const name = prompt('Tên nguyên liệu:'); if (!name) return; const unit = prompt('Đơn vị (kg, chai, thùng...):', 'kg'); const currentStock = Number(prompt('Tồn kho ban đầu:', '0')); const minimumStock = Number(prompt('Mức cảnh báo:', '0')); action(() => api('/api/inventory', { method: 'POST', body: JSON.stringify({ name, unit, currentStock, minimumStock, supplier: '' }) }), 'Đã thêm nguyên liệu'); };
  const adjust = (item, type) => { const quantity = Number(prompt(type === 'import' ? 'Số lượng nhập:' : 'Số lượng sử dụng:')); if (!quantity) return; const note = prompt('Ghi chú:', '') || ''; action(() => api(`/api/inventory/${item._id}/adjust`, { method: 'PATCH', body: JSON.stringify({ type, quantity, note }) }), 'Đã cập nhật tồn kho'); };
  return <><div className="toolbar">{user.role === 'admin' && <button className="primary-button compact-button" onClick={add}>+ Thêm nguyên liệu</button>}</div><div className="inventory-grid">{(data.items || []).map(item => <article className={`inventory-card ${item.isLowStock ? 'low' : ''}`} key={item._id}><PackageOpen/><div><h3>{item.name}</h3><p>{item.supplier || 'Chưa có nhà cung cấp'}</p></div><strong>{item.currentStock} <small>{item.unit}</small></strong><span>Mức tối thiểu: {item.minimumStock} {item.unit}</span>{item.isLowStock && <b className="stock-warning">Sắp hết hàng</b>}<footer><button onClick={() => adjust(item, 'import')}>Nhập kho</button><button onClick={() => adjust(item, 'usage')}>Xuất dùng</button></footer></article>)}</div></>;
}

function MenuManagement({ data, action }) {
  const add = () => { const name = prompt('Tên món:'); if (!name) return; const price = Number(prompt('Giá món:')); const category = prompt(`Nhập ID danh mục:\n${(data.categories || []).map(item => `${item.name}: ${item._id}`).join('\n')}`); action(() => api('/api/admin/foods', { method: 'POST', body: JSON.stringify({ name, price, category, description: '', unit: 'Phần', imageUrl: '', tags: [], isAvailable: true }) }), 'Đã thêm món'); };
  const editPrice = food => { const price = Number(prompt(`Giá mới cho ${food.name}:`, food.price)); if (!Number.isFinite(price)) return; action(() => api(`/api/admin/foods/${food._id}`, { method: 'PUT', body: JSON.stringify({ price }) }), 'Đã cập nhật giá'); };
  const uploadImage = (food, file) => { if (!file) return; const reader = new FileReader(); reader.onload = () => action(() => api(`/api/admin/foods/${food._id}/image`, { method: 'POST', body: JSON.stringify({ dataUrl: reader.result }) }), 'Đã cập nhật ảnh món'); reader.readAsDataURL(file); };
  return <><div className="toolbar"><button className="primary-button compact-button" onClick={add}>+ Thêm món</button></div><div className="admin-table-wrap"><table><thead><tr><th>Món</th><th>Danh mục</th><th>Giá</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{(data.foods || []).map(food => <tr key={food._id}><td><div className="food-cell"><img src={food.imageUrl || '/placeholder-food.svg'}/><b>{food.name}</b></div></td><td>{food.category?.name}</td><td>{money(food.price)}</td><td><span className={`status ${food.isAvailable ? 'completed' : 'cancelled'}`}>{food.isAvailable ? 'Đang bán' : 'Ngừng bán'}</span></td><td><button className="table-action" onClick={() => editPrice(food)}>Sửa giá</button><label className="table-action file-action">Đổi ảnh<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => uploadImage(food, e.target.files?.[0])}/></label><button className="table-action" onClick={() => action(() => api(`/api/admin/foods/${food._id}`, { method: 'PUT', body: JSON.stringify({ isAvailable: !food.isAvailable }) }), 'Đã cập nhật món')}>{food.isAvailable ? 'Ngừng bán' : 'Mở bán'}</button></td></tr>)}</tbody></table></div></>;
}

function CategoryManagement({ data, action }) {
  const add = () => { const name = prompt('Tên danh mục:'); if (!name) return; const type = confirm('Nhấn OK nếu là đồ uống, Cancel nếu là món ăn') ? 'drink' : 'food'; action(() => api('/api/admin/categories', { method: 'POST', body: JSON.stringify({ name, type, description: '' }) }), 'Đã thêm danh mục'); };
  return <><div className="toolbar"><button className="primary-button compact-button" onClick={add}>+ Thêm danh mục</button></div><div className="simple-card-list">{(data.categories || []).map(item => <article key={item._id}><Tags/><div><h3>{item.name}</h3><p>{item.description}</p></div><span>{item.type === 'drink' ? 'Đồ uống' : 'Món ăn'}</span></article>)}</div></>;
}

function Users({ data, action }) {
  return <div className="admin-table-wrap"><table><thead><tr><th>Người dùng</th><th>Liên hệ</th><th>Vai trò</th><th>Trạng thái</th></tr></thead><tbody>{(data.users || []).map(item => <tr key={item._id}><td><b>{item.fullName}</b><small>{item.loyaltyPoints || 0} điểm</small></td><td>{item.email}<small>{item.phone}</small></td><td><select value={item.role} onChange={e => action(() => api(`/api/admin/users/${item._id}`, { method: 'PATCH', body: JSON.stringify({ role: e.target.value }) }), 'Đã đổi vai trò')}>{Object.entries(roleLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></td><td><button className={`toggle-button ${item.isActive ? 'active' : ''}`} onClick={() => action(() => api(`/api/admin/users/${item._id}`, { method: 'PATCH', body: JSON.stringify({ isActive: !item.isActive }) }), 'Đã cập nhật tài khoản')}>{item.isActive ? 'Hoạt động' : 'Đã khóa'}</button></td></tr>)}</tbody></table></div>;
}

function Promotions({ data, action }) {
  const add = () => { const name = prompt('Tên chương trình:'); const code = prompt('Mã khuyến mãi:'); if (!name || !code) return; const discountValue = Number(prompt('Phần trăm giảm:', '10')); const minOrderValue = Number(prompt('Giá trị đơn tối thiểu:', '200000')); const startAt = new Date().toISOString(); const endAt = new Date(Date.now() + 30 * 86400000).toISOString(); action(() => api('/api/promotions', { method: 'POST', body: JSON.stringify({ name, code, discountType: 'percent', discountValue, minOrderValue, startAt, endAt, description: '', isActive: true }) }), 'Đã tạo khuyến mãi'); };
  return <><div className="toolbar"><button className="primary-button compact-button" onClick={add}>+ Tạo khuyến mãi</button></div><div className="simple-card-list">{(data.promotions || []).map(item => <article key={item._id}><Percent/><div><h3>{item.name} · {item.code}</h3><p>{item.discountType === 'percent' ? `Giảm ${item.discountValue}%` : `Giảm ${money(item.discountValue)}`} · Đơn từ {money(item.minOrderValue)}</p></div><button className="table-action" onClick={() => action(() => api(`/api/promotions/${item._id}`, { method: 'PUT', body: JSON.stringify({ isActive: !item.isActive }) }), 'Đã cập nhật khuyến mãi')}>{item.isActive ? 'Đang bật' : 'Đã tắt'}</button></article>)}</div></>;
}

function Reports({ data: initial }) {
  const [data, setData] = useState(initial);
  const [from, setFrom] = useState(initial.from ? new Date(initial.from).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }) : '');
  const [to, setTo] = useState(initial.to ? new Date(initial.to).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }) : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const filter = async event => {
    event.preventDefault(); setBusy(true); setError('');
    try { setData(await api('/api/admin/reports?' + new URLSearchParams({ from, to }))); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  return <><form className="customer-toolbar report-filter" onSubmit={filter}><label>Từ ngày<input type="date" required value={from} onChange={e => setFrom(e.target.value)}/></label><label>Đến ngày<input type="date" required min={from} value={to} onChange={e => setTo(e.target.value)}/></label><button className="primary-button compact-button" disabled={busy}>{busy ? 'Đang tải...' : 'Xem báo cáo'}</button></form>
    <p className="payment-notice">Doanh thu theo thời điểm thu tiền, múi giờ Việt Nam; chỉ tính đơn đã thanh toán. Tiền món đã phân bổ giảm giá.</p>{error && <p className="payment-error">{error}</p>}
    <div className="stat-grid operations-stats"><div><BarChart3/><span>Doanh thu đã thu</span><strong>{money(data.summary?.revenue || 0)}</strong></div><div><ClipboardList/><span>Đơn đã thanh toán</span><strong>{data.summary?.orders || 0}</strong></div><div><Utensils/><span>Trung bình / đơn</span><strong>{money(data.summary?.averageOrder || 0)}</strong></div></div>
    <div className="report-grid"><div className="admin-table-wrap"><h2>Món bán chạy</h2><table><thead><tr><th>Món</th><th>Số lượng</th><th>Tiền món sau giảm</th></tr></thead><tbody>{(data.topFoods || []).map(item => <tr key={item._id}><td>{item.name}</td><td>{item.quantity}</td><td>{money(item.revenue)}</td></tr>)}</tbody></table>{!data.topFoods?.length && <p className="empty">Chưa có dữ liệu.</p>}</div>
      <div className="admin-table-wrap"><h2>Doanh thu theo ngày</h2><table><thead><tr><th>Ngày thu tiền</th><th>Đơn</th><th>Doanh thu</th></tr></thead><tbody>{(data.daily || []).map(item => <tr key={item._id}><td>{item._id}</td><td>{item.orders}</td><td>{money(item.revenue)}</td></tr>)}</tbody></table>{!data.daily?.length && <p className="empty">Chưa có doanh thu.</p>}</div></div>
  </>;
}


function NoSQLOverview({ data }) {
  const total = values => (values || []).reduce((sum, item) => sum + item.count, 0);
  return <div className="nosql-console">
    <p className="nosql-note">Dữ liệu được đọc trực tiếp từ ba hệ quản trị đang chạy, không phải số liệu giả lập.
      Chỉ quản trị viên được xem trang này. Không hiển thị mật khẩu hoặc thông tin cá nhân.</p>
    <div className="nosql-grid">
      <article className="nosql-database"><div className="nosql-header"><Database size={26}/><div><h2>MongoDB</h2><p>Document · localhost:27017</p></div></div>
        <strong>{total(data.mongodb?.collections)} tài liệu</strong>
        <p>Database: <code>{data.mongodb?.database || 'restaurant_nosql'}</code></p>
        <div className="nosql-rows">{(data.mongodb?.collections || []).map(item => <p key={item.name}><code>{item.name}</code><b>{item.count}</b></p>)}</div>
        <small>Code: backend/src/models/ · backend/src/config/database.js</small>
      </article>
      <article className="nosql-database"><div className="nosql-header"><HardDrive size={26}/><div><h2>Redis</h2><p>Key-value · localhost:6379</p></div></div>
        <strong>{data.redis?.leaderboardItems ?? 0} món trong bảng xếp hạng</strong>
        <div className="nosql-rows">
          <p><code>cart:*</code><b>{data.redis?.cartKeys ?? 0} key</b></p>
          <p><code>table:lock:*</code><b>{data.redis?.tableLockKeys ?? 0} key</b></p>
          <p><code>token:block:*</code><b>{data.redis?.revokedTokenKeys ?? 0} key</b></p>
          <p><code>menu:categories TTL</code><b>{data.redis?.menuCacheTtlSeconds ?? '-'} giây</b></p>
        </div><small>Code: backend/src/services/cart.js · cache.js · config/database.js</small>
      </article>
      <article className="nosql-database"><div className="nosql-header"><Network size={26}/><div><h2>Neo4j</h2><p>Graph · localhost:7474</p></div></div>
        <strong>{(data.neo4j?.nodes || []).reduce((s,x)=>s+x.count,0)} node</strong>
        <div className="nosql-rows">{(data.neo4j?.nodes || []).map(item => <p key={item.name}><code>{item.name}</code><b>{item.count}</b></p>)}</div>
        <h3>Quan hệ</h3><div className="nosql-rows">{(data.neo4j?.relationships || []).map(item => <p key={item.name}><code>{item.name}</code><b>{item.count}</b></p>)}</div>
        <small>Code: backend/src/services/graph.js · config/database.js</small>
      </article>
    </div>
    <p className="nosql-note">Bạn có thể mở <a href="http://localhost:7474" target="_blank" rel="noreferrer">Neo4j Browser</a>,
      MongoDB Compass tại mongodb://localhost:27017 hoặc Redis CLI để xem trực tiếp. Số lượng key Redis thay đổi
      theo thời gian và số lượt thao tác. Kiểm tra lúc: {data.checkedAt ? new Date(data.checkedAt).toLocaleString('vi-VN') : '—'}.</p>
  </div>;
}
