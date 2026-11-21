import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './config/env.js';
import authRoutes from './routes/auth.js';
import catalogRoutes from './routes/catalog.js';
import cartRoutes from './routes/cart.js';
import orderRoutes from './routes/orders.js';
import reviewRoutes from './routes/reviews.js';
import recommendationRoutes from './routes/recommendations.js';
import adminRoutes from './routes/admin.js';
import profileRoutes from './routes/profile.js';
import favoriteRoutes from './routes/favorites.js';
import notificationRoutes from './routes/notifications.js';
import tableRoutes from './routes/tables.js';
import reservationRoutes from './routes/reservations.js';
import promotionRoutes from './routes/promotions.js';
import inventoryRoutes from './routes/inventory.js';
import staffRoutes from './routes/staff.js';
import paymentRoutes from './routes/payments.js';
import { errorHandler, notFound } from './utils/errors.js';

const app = express();
const currentDir = path.dirname(fileURLToPath(import.meta.url));

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: env.clientUrl }));
app.use(express.json({ limit: '5mb' }));
app.use(morgan('dev'));
app.use('/images', express.static(path.join(currentDir, '../public/images')));

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'restaurant-nosql-api' }));
app.use('/api/auth', authRoutes);
app.use('/api', catalogRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/tables', tableRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/payments', paymentRoutes);
app.use(notFound);
app.use(errorHandler);

export default app;

