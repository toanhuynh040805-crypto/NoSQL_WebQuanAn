import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

export default function CustomerPicker({ value, onChange }) {
  const [search, setSearch] = useState('');
  const [customers, setCustomers] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      if (search.trim().length < 2) { setCustomers([]); return; }
      api('/api/customers?' + new URLSearchParams({ search, state: 'active', limit: '5' }), { signal: controller.signal })
        .then(data => { setCustomers(data.customers); setError(''); })
        .catch(e => { if (e.name !== 'AbortError') setError(e.message); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [search]);
  return <div className="customer-picker"><label>Gắn khách thành viên (không bắt buộc)<input placeholder="Tìm tên, SĐT hoặc email..." value={value ? `${value.fullName} · ${value.phone || value.email}` : search} disabled={Boolean(value)} onChange={e => setSearch(e.target.value)}/></label>
    {value && <button className="table-action" type="button" onClick={() => { onChange(null); setSearch(''); }}>Bỏ chọn thành viên</button>}
    {!value && customers.map(customer => <button className="customer-picker-option" type="button" key={customer._id} onClick={() => { onChange(customer); setCustomers([]); }}><b>{customer.fullName}</b><span>{customer.phone || customer.email} · {customer.loyaltyPoints || 0} điểm</span></button>)}
    {!value && search.trim().length >= 2 && !customers.length && !error && <small>Không có khách phù hợp. Có thể nhận bàn khách vãng lai.</small>}
    {error && <small className="payment-error">{error}</small>}
  </div>;
}
