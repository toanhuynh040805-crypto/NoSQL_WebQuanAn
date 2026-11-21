import { CheckCircle2, ChefHat, Clock3, Flame } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { api } from '../lib/api.js';

const columns = [
  { status: 'confirmed', title: 'Chờ chế biến', icon: Clock3 },
  { status: 'preparing', title: 'Đang chế biến', icon: Flame },
  { status: 'ready', title: 'Sẵn sàng', icon: CheckCircle2 }
];

export default function KitchenPage() {
  const { user, authReady, notify } = useApp();
  const [orders, setOrders] = useState([]);
  const load = () => api('/api/orders/queue').then(data => setOrders(data.orders));
  useEffect(() => {
    if (!user || !['admin', 'kitchen'].includes(user.role)) return;
    load(); const timer = setInterval(load, 10000); return () => clearInterval(timer);
  }, [user]);
  if (!authReady) return <div className="empty">Đang xác thực...</div>;
  if (!user || !['admin', 'kitchen'].includes(user.role)) return <Navigate to="/" replace />;
  const update = async (id, status) => {
    try { await api(`/api/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }); await load(); notify('Đã cập nhật món tại bếp'); }
    catch (error) { notify(error.message); }
  };
  return <section className="kitchen-page">
    <div className="kitchen-header"><div><ChefHat size={32}/><div><span>BẾP NHÀ</span><h1>Màn hình chế biến</h1></div></div><small>Tự động cập nhật mỗi 10 giây</small></div>
    <div className="kitchen-board">{columns.map(column => {
      const Icon = column.icon; const items = orders.filter(order => order.status === column.status)
        .sort((a, b) => Number(b.priority === 'urgent') - Number(a.priority === 'urgent'));
      return <section className={`kitchen-column ${column.status}`} key={column.status}><h2><Icon/>{column.title}<b>{items.length}</b></h2><div>
        {items.map(order => <article className="kitchen-ticket" key={order._id}><header><strong>{order.orderCode}{order.priority === 'urgent' && <span className="kitchen-urgent"> · ƯU TIÊN</span>}</strong><span>{order.tableNumber || 'Mang về'}</span></header><small>{new Date(order.createdAt).toLocaleTimeString('vi-VN')}</small><ul>{order.items.map((item, index) => <li key={index}><b>{item.quantity}×</b><span>{item.name}{item.note && <em>{item.note}</em>}</span></li>)}</ul>{order.note && <p>Ghi chú: {order.note}</p>}
          {column.status === 'confirmed' && <button onClick={() => update(order._id, 'preparing')}>Bắt đầu chế biến</button>}
          {column.status === 'preparing' && <button onClick={() => update(order._id, 'ready')}>Đã hoàn thành món</button>}
        </article>)}
      </div></section>;
    })}</div>
  </section>;
}

