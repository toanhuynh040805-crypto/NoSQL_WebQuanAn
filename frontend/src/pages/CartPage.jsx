import { ArrowLeft, Minus, Plus, ReceiptText, ShoppingBag } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { api, money } from '../lib/api.js';

export default function CartPage() {
  const { cart, updateCart, user, refreshCart, notify } = useApp();
  const [tableNumber, setTableNumber] = useState('');
  const [orderType, setOrderType] = useState('dine-in');
  const [note, setNote] = useState('');
  const [promotionCode, setPromotionCode] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [tables, setTables] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  useEffect(() => {
    Promise.all([api('/api/tables'), api('/api/promotions/active')]).then(([tableData, promoData]) => {
      setTables(tableData.tables.filter(table => ['available', 'reserved'].includes(table.status)));
      setPromotions(promoData.promotions);
    }).catch(() => {});
  }, []);

  const submit = async () => {
    if (!user) return navigate('/login?next=/cart');
    setSubmitting(true);
    try {
      const data = await api('/api/orders', {
        method: 'POST', body: JSON.stringify({
          orderType, tableNumber: orderType === 'dine-in' ? tableNumber : undefined,
          note, promotionCode: promotionCode || undefined, paymentMethod
        })
      });
      await refreshCart();
      notify(`Đặt món thành công: ${data.order.orderCode}`);
      navigate('/orders');
    } catch (error) {
      notify(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!cart.length) return <section className="page narrow empty-cart"><ShoppingBag size={64} /><h1>Giỏ hàng đang trống</h1><p>Hãy chọn món ngon bạn muốn dùng tại quán.</p><Link className="primary-button" to="/"><ArrowLeft size={18}/> Xem thực đơn</Link></section>;

  return <section className="page">
    <div className="page-title"><div><span className="eyebrow">Đơn gọi món</span><h1>Giỏ hàng của bạn</h1></div><Link to="/"><ArrowLeft size={17}/> Chọn thêm món</Link></div>
    <div className="checkout-grid">
      <div className="cart-list">
        {cart.map(item => <article className="cart-item" key={item.foodId}>
          <img src={item.imageUrl || '/placeholder-food.svg'} alt={item.name}/>
          <div><h3>{item.name}</h3><span>{money(item.price)}</span></div>
          <div className="quantity"><button onClick={() => updateCart(item.foodId, item.quantity - 1)}><Minus size={16}/></button><b>{item.quantity}</b><button onClick={() => updateCart(item.foodId, item.quantity + 1)}><Plus size={16}/></button></div>
          <strong>{money(item.price * item.quantity)}</strong>
        </article>)}
      </div>
      <aside className="checkout-card">
        <div className="checkout-title"><ReceiptText size={22}/><h2>Thông tin đặt món</h2></div>
        <label>Hình thức<select value={orderType} onChange={e => setOrderType(e.target.value)}><option value="dine-in">Dùng tại quán</option><option value="takeaway">Mang về</option></select></label>
        {orderType === 'dine-in' && <label>Chọn bàn<select value={tableNumber} onChange={e => setTableNumber(e.target.value)}><option value="">Chọn bàn còn trống</option>{tables.map(table => <option key={table._id} value={table.name}>{table.name} · {table.area} · {table.capacity} chỗ</option>)}</select></label>}
        <label>Phương thức thanh toán<select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}><option value="cash">Tiền mặt (thanh toán tại quầy)</option><option value="bank-transfer">Chuyển khoản BIDV (VietQR)</option></select></label>
        <label>Mã khuyến mãi<input value={promotionCode} onChange={e => setPromotionCode(e.target.value.toUpperCase())} placeholder="Ví dụ: WELCOME10" /></label>
        {promotions.length > 0 && <div className="promotion-hints">{promotions.map(item => <button type="button" key={item._id} onClick={() => setPromotionCode(item.code)}><b>{item.code}</b><span>{item.description || item.name}</span></button>)}</div>}
        <label>Ghi chú<textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Ít cay, không hành..." /></label>
        <div className="total"><span>Tổng cộng</span><strong>{money(total)}</strong></div>
        <button className="order-button" disabled={submitting || (orderType === 'dine-in' && !tableNumber)} onClick={submit}>{submitting ? 'Đang gửi...' : user ? 'Xác nhận đặt món' : 'Đăng nhập để đặt món'}</button>
        <small>Khuyến mãi được kiểm tra và tính lại khi xác nhận đơn. Với chuyển khoản, QR chính xác sẽ hiển thị ở mục Đơn của tôi; chỉ thu ngân mới xác nhận khi tiền thực nhận.</small>
      </aside>
    </div>
  </section>;
}

