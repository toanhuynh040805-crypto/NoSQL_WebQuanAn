import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [cart, setCart] = useState([]);
  const [toast, setToast] = useState('');
  const [favoriteIds, setFavoriteIds] = useState([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const notify = message => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2600);
  };

  const refreshCart = async () => {
    const data = await api('/api/cart');
    setCart(data.items);
  };

  const refreshAccountExtras = async () => {
    if (!localStorage.getItem('token')) return;
    const [favorites, notifications] = await Promise.all([
      api('/api/favorites'), api('/api/notifications')
    ]);
    setFavoriteIds(favorites.foods.map(food => food._id));
    setUnreadNotifications(notifications.unread);
  };

  useEffect(() => {
    refreshCart().catch(() => {});
    if (localStorage.getItem('token')) {
      api('/api/auth/me').then(data => {
        setUser(data.user);
        return refreshAccountExtras();
      }).catch(() => localStorage.removeItem('token')).finally(() => setAuthReady(true));
    } else {
      setAuthReady(true);
    }
  }, []);

  const login = async credentials => {
    const data = await api('/api/auth/login', { method: 'POST', body: JSON.stringify(credentials) });
    localStorage.setItem('token', data.token);
    setUser(data.user);
    await refreshCart();
    await refreshAccountExtras();
    notify(`Xin chào ${data.user.fullName}`);
    return data.user;
  };

  const register = async payload => {
    const data = await api('/api/auth/register', { method: 'POST', body: JSON.stringify(payload) });
    localStorage.setItem('token', data.token);
    setUser(data.user);
    await refreshAccountExtras();
    notify('Đăng ký thành công');
    return data.user;
  };

  const logout = async () => {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
    localStorage.removeItem('token');
    setUser(null);
    setFavoriteIds([]);
    setUnreadNotifications(0);
    await refreshCart();
  };

  const toggleFavorite = async foodId => {
    if (!user) throw new Error('Vui lòng đăng nhập để lưu món yêu thích');
    const isFavorite = favoriteIds.includes(foodId);
    await api(`/api/favorites/${foodId}`, { method: isFavorite ? 'DELETE' : 'POST' });
    setFavoriteIds(current => isFavorite ? current.filter(id => id !== foodId) : [...current, foodId]);
    notify(isFavorite ? 'Đã bỏ khỏi yêu thích' : 'Đã thêm vào yêu thích');
  };

  const addToCart = async food => {
    const existing = cart.find(item => item.foodId === food._id);
    const data = await api(`/api/cart/items/${food._id}`, {
      method: 'PUT', body: JSON.stringify({ quantity: (existing?.quantity || 0) + 1, note: existing?.note || '' })
    });
    setCart(data.items);
    notify(`Đã thêm ${food.name}`);
  };

  const updateCart = async (foodId, quantity) => {
    if (quantity < 1) {
      const data = await api(`/api/cart/items/${foodId}`, { method: 'DELETE' });
      return setCart(data.items);
    }
    const current = cart.find(item => item.foodId === foodId);
    const data = await api(`/api/cart/items/${foodId}`, {
      method: 'PUT', body: JSON.stringify({ quantity, note: current?.note || '' })
    });
    setCart(data.items);
  };

  const value = useMemo(() => ({
    user, authReady, cart, toast, favoriteIds, unreadNotifications,
    login, register, logout, addToCart, updateCart, refreshCart,
    refreshAccountExtras, toggleFavorite, setUnreadNotifications, notify
  }), [user, authReady, cart, toast, favoriteIds, unreadNotifications]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useApp = () => useContext(AppContext);

