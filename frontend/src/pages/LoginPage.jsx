import { ChefHat } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { getHomePath } from '../lib/roleHome.js';

export default function LoginPage() {
  const { login, register } = useApp();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ fullName: '', phone: '', email: 'khach@quanan.vn', password: '123456' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const submit = async event => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const loggedIn = mode === 'login'
        ? await login({ email: form.email, password: form.password })
        : await register(form);
      const defaultPage = getHomePath(loggedIn.role);
      const next = params.get('next');
      navigate(next?.startsWith('/') && !next.startsWith('//') ? next : defaultPage);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return <section className="auth-page">
    <div className="auth-panel"><div className="auth-mark"><ChefHat size={38}/></div><span className="eyebrow">Chào mừng đến Bếp Nhà</span><h1>{mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}</h1><p>Đặt món nhanh hơn và theo dõi lịch sử đơn ngay tại đây.</p>
      <form onSubmit={submit}>
        {mode === 'register' && <><label>Họ và tên<input required value={form.fullName} onChange={e => setForm({...form, fullName: e.target.value})}/></label><label>Số điện thoại<input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}/></label></>}
        <label>Email<input required type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}/></label>
        <label>Mật khẩu<input required minLength="6" type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})}/></label>
        {error && <p className="form-error">{error}</p>}
        <button className="order-button" disabled={busy}>{busy ? 'Đang xử lý...' : mode === 'login' ? 'Đăng nhập' : 'Đăng ký'}</button>
      </form>
      <button className="text-button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Chưa có tài khoản? Đăng ký' : 'Đã có tài khoản? Đăng nhập'}</button>
      {mode === 'login' && <small className="demo-note">Tài khoản demo đã được điền sẵn sau khi chạy seed.</small>}
    </div>
  </section>;
}

