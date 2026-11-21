import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import { AppProvider } from './context/AppContext.jsx';
import CartPage from './pages/CartPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import MenuPage from './pages/MenuPage.jsx';
import OrdersPage from './pages/OrdersPage.jsx';
import FavoritesPage from './pages/FavoritesPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import NotificationsPage from './pages/NotificationsPage.jsx';
import ReservationsPage from './pages/ReservationsPage.jsx';
import KitchenPage from './pages/KitchenPage.jsx';
import OperationsPage from './pages/OperationsPage.jsx';
import StaffTablesPage from './pages/StaffTablesPage.jsx';
import { useApp } from './context/AppContext.jsx';
import { getHomePath } from './lib/roleHome.js';
import './styles.css';

function HomePage() {
  const { user, authReady } = useApp();
  if (!authReady) return <div className="empty">Đang xác thực tài khoản...</div>;
  const destination = getHomePath(user?.role);
  return destination === '/' ? <MenuPage/> : <Navigate to={destination} replace/>;
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode><BrowserRouter><AppProvider><Layout><Routes>
    <Route path="/" element={<HomePage/>}/>
    <Route path="/menu" element={<MenuPage/>}/>
    <Route path="/cart" element={<CartPage/>}/>
    <Route path="/login" element={<LoginPage/>}/>
    <Route path="/orders" element={<OrdersPage/>}/>
    <Route path="/admin" element={<OperationsPage/>}/>
    <Route path="/operations" element={<OperationsPage/>}/>
    <Route path="/kitchen" element={<KitchenPage/>}/>
    <Route path="/staff/tables" element={<StaffTablesPage/>}/>
    <Route path="/reservations" element={<ReservationsPage/>}/>
    <Route path="/favorites" element={<FavoritesPage/>}/>
    <Route path="/profile" element={<ProfilePage/>}/>
    <Route path="/notifications" element={<NotificationsPage/>}/>
  </Routes></Layout></AppProvider></BrowserRouter></React.StrictMode>
);

