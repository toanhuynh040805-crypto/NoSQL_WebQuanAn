import { Clock3, PackageCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { api, money } from '../lib/api.js';
import PaymentDialog from '../components/PaymentDialog.jsx';

const labels = { pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận', preparing: 'Đang chế biến', ready: 'Sẵn sàng phục vụ', completed: 'Hoàn thành', cancelled: 'Đã hủy' };

export default function OrdersPage() {
  const { user, notify } = useApp();
  const [orders, setOrders] = useState([]);
  const [payOrder, setPayOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const load = () => api('/api/orders/mine').then(data => setOrders(data.orders)).finally(() => setLoading(false));
  useEffect(() => { if (user) load(); }, [user]);
  if (!user) return <Navigate to="/login?next=/orders" replace/>;
  return <section className="page narrow">
    <div className="page-title"><div><span className="eyebrow">Theo dõi</span><h1>Đơn của tôi</h1></div></div>
    {loading ? <div className="empty">Đang tải...</div> : !orders.length ? <div className="empty-cart"><PackageCheck size={58}/><h2>Chưa có đơn nào</h2><Link className="primary-button" to="/">Chọn món ngay</Link></div> : <div className="orders-list">
      {orders.map(order => <article className="order-card" key={order._id}>
        <div className="order-header"><div><small>Mã đơn</small><h3>{order.orderCode}</h3></div><span className={`status ${order.status}`}><Clock3 size={14}/>{labels[order.status]}</span></div>
        <ul>{order.items.map((item, index) => <li key={index}><span>{item.quantity} × {item.name}</span><b>{money(item.price * item.quantity)}</b>{order.status === 'completed' && <button className="review-button" onClick={async () => { const rating = Number(prompt(`Đánh giá ${item.name} từ 1 đến 5:`, '5')); if (rating < 1 || rating > 5) return; const comment = prompt('Nhận xét của bạn:', '') || ''; try { await api('/api/reviews', { method: 'POST', body: JSON.stringify({ foodId: item.food, orderId: order._id, rating, comment }) }); notify('Cảm ơn bạn đã đánh giá'); } catch (error) { notify(error.message); } }}>Đánh giá</button>}</li>)}</ul>
        {order.discountAmount > 0 && <div className="order-discount"><span>Khuyến mãi {order.promotionCode}</span><b>-{money(order.discountAmount)}</b></div>}
        <div className="order-footer"><span>{new Date(order.createdAt).toLocaleString('vi-VN')} · {order.paymentStatus === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán'}</span><strong>{money(order.totalAmount ?? order.subtotal)}</strong></div>
        {order.paymentStatus === 'paid' && order.paymentReceipt &&
          <button type="button" className="table-action" onClick={() => setPayOrder(order)}>Xem phiếu thu</button>}
        {order.paymentStatus !== 'paid' && order.paymentMethod === 'bank-transfer' && order.status !== 'cancelled' &&
          <button className="table-action" type="button" onClick={() => setPayOrder(order)}>Xem QR chuyển khoản BIDV</button>}
        {order.paymentStatus !== 'paid' && order.paymentMethod !== 'bank-transfer' && order.status !== 'cancelled' &&
          <p className="payment-notice">Thanh toán tiền mặt khi nhận món hoặc tại quầy thu ngân.</p>}
        {order.status === 'pending' && <button className="danger-link" onClick={async () => { if (!confirm('Bạn muốn hủy đơn này?')) return; try { await api(`/api/orders/${order._id}/cancel`, { method: 'PATCH' }); notify('Đã hủy đơn'); await load(); } catch (error) { notify(error.message); } }}>Hủy đơn</button>}
      </article>)}
    </div>}
    {payOrder && <PaymentDialog scope="order" id={payOrder._id} readOnly suggestedMethod="bank-transfer"
      onClose={() => setPayOrder(null)}/>}
  </section>;
}

