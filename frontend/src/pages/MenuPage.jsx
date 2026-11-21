import { AlertCircle, RefreshCw, Search, Utensils } from 'lucide-react';
import { useEffect, useState } from 'react';
import FoodCard from '../components/FoodCard.jsx';
import { useApp } from '../context/AppContext.jsx';
import { api } from '../lib/api.js';

export default function MenuPage() {
  const { user } = useApp();
  const [foods, setFoods] = useState([]);
  const [recommended, setRecommended] = useState([]);
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [foodError, setFoodError] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [retry, setRetry] = useState(0);
  const reload = () => setRetry(value => value + 1);

  useEffect(() => {
    const controller = new AbortController();
    setCategoryError('');
    // A temporary Neo4j recommendation outage must not hide the MongoDB categories.
    api('/api/categories', { signal: controller.signal })
      .then(data => {
        if (!Array.isArray(data.categories)) throw new Error('API danh mục trả về dữ liệu không hợp lệ');
        setCategories(data.categories);
      })
      .catch(error => {
        if (!controller.signal.aborted) setCategoryError(error.message);
      });
    api('/api/recommendations', { signal: controller.signal })
      .then(data => setRecommended(Array.isArray(data.foods) ? data.foods.slice(0, 4) : []))
      .catch(() => setRecommended([]));
    return () => controller.abort();
  }, [retry]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setFoodError('');
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ limit: '50' });
      if (category) params.set('category', category);
      if (search.trim()) params.set('search', search.trim());
      api('/api/foods?' + params.toString(), { signal: controller.signal })
        .then(data => {
          if (!Array.isArray(data.foods)) throw new Error('API thực đơn trả về dữ liệu không hợp lệ');
          if (!controller.signal.aborted) setFoods(data.foods);
        })
        .catch(error => {
          if (!controller.signal.aborted) {
            setFoodError(error.message || 'Không thể kết nối API thực đơn');
            setFoods([]);
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [category, search, retry]);

  return <>
    <section className="hero">
      <div className="hero-copy">
        <span className="eyebrow">Hương vị Việt trong từng món ăn</span>
        <h1>Món ngon tại bàn,<em> chọn là có ngay.</em></h1>
        <p>Xem thực đơn, chọn món và theo dõi đơn ngay trên website. Không cần chờ gọi nhân viên.</p>
        <div className="search-box"><Search size={20}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Tìm lẩu bò, món nhắm, đồ uống..."/></div>
      </div>
      <div className="hero-art">
        <div className="plate" aria-label="Bếp Nhà">
          <Utensils className="plate-utensils" size={70} aria-hidden="true"/>
          <span className="plate-wordmark">BẾP NHÀ</span>
        </div>
        <span className="leaf leaf-one" aria-hidden="true">✦</span>
        <span className="leaf leaf-two" aria-hidden="true">❧</span>
      </div>
    </section>

    {recommended.length > 0 && !search && !category && <section className="section recommendations">
      <div className="section-heading"><div><span className="eyebrow">Dành cho bạn</span><h2>Gợi ý hôm nay</h2></div><p>Neo4j phân tích sở thích và các lượt gọi món tương tự.</p></div>
      <div className="food-grid compact">{recommended.map(food => <FoodCard food={food} key={food._id}/>)}</div>
    </section>}

    <section className="section menu-section">
      <div className="section-heading"><div><span className="eyebrow">Khám phá</span><h2>Thực đơn của quán</h2></div></div>
      {categoryError && <div className="menu-data-warning" role="alert">
        <AlertCircle size={19}/><span>Không tải được danh mục: {categoryError}</span>
        <button type="button" onClick={reload}><RefreshCw size={15}/> Thử lại</button>
      </div>}
      <div className="category-tabs">
        <button className={!category ? 'active' : ''} onClick={() => setCategory('')}>Tất cả</button>
        {categories.map(item => <button key={item._id} className={category === item._id ? 'active' : ''} onClick={() => setCategory(item._id)}>{item.name}</button>)}
      </div>
      {loading ? <div className="empty">Đang tải thực đơn...</div> : foodError ?
        <div className="menu-empty-diagnostic" role="alert">
          <AlertCircle size={31}/><h3>Không thể tải thực đơn</h3>
          <p>{foodError}</p><p>Kiểm tra backend tại cổng 5000 và trạng thái kết nối MongoDB.</p>
          <button type="button" className="secondary-button" onClick={reload}><RefreshCw size={17}/> Tải lại thực đơn</button>
        </div> : foods.length ?
        <div className="food-grid">{foods.map(food => <FoodCard food={food} key={food._id}/>)}</div> :
        !search.trim() && !category ?
          <div className="menu-empty-diagnostic">
            <Utensils size={36}/><h3>Thực đơn chưa có dữ liệu</h3>
            <p>MongoDB chưa chứa món đang phục vụ. Hãy khôi phục danh mục và món từ KLCN để tiếp tục đặt món.</p>
            {user?.role === 'admin' && <p>Quản trị viên: chạy lệnh <code>npm run restore:menu</code> tại thư mục dự án; lệnh không xóa đơn hàng hay tài khoản.</p>}
            <button type="button" className="secondary-button" onClick={reload}><RefreshCw size={17}/> Kiểm tra lại</button>
          </div> : <div className="empty">Không tìm thấy món phù hợp. Thử đổi danh mục hoặc từ khóa.</div>}
    </section>
  </>;
}
