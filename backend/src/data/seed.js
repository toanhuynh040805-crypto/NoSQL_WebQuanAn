import bcrypt from 'bcryptjs';
import { connectDatabases, closeDatabases, redis } from '../config/database.js';
import { Category } from '../models/Category.js';
import { Food } from '../models/Food.js';
import { Order } from '../models/Order.js';
import { Review } from '../models/Review.js';
import { User } from '../models/User.js';
import { DiningTable } from '../models/DiningTable.js';
import { Reservation } from '../models/Reservation.js';
import { Promotion } from '../models/Promotion.js';
import { Notification } from '../models/Notification.js';
import { InventoryItem } from '../models/InventoryItem.js';
import { TableSession } from '../models/TableSession.js';
import { PaymentReceipt } from '../models/PaymentReceipt.js';
import { catalog, categoryDefinitions } from './menuCatalog.js';
import { clearGraphData, ensureGraphConstraints, recordOrderGraph, syncCatalogGraph } from '../services/graph.js';



async function seed() {
  await connectDatabases();
  await ensureGraphConstraints();
  await clearGraphData();
  await Promise.all([
    Order.deleteMany({}), Review.deleteMany({}), Food.deleteMany({}), Category.deleteMany({}),
    User.deleteMany({}), DiningTable.deleteMany({}), Reservation.deleteMany({}),
    Promotion.deleteMany({}), Notification.deleteMany({}), InventoryItem.deleteMany({}), TableSession.deleteMany({}), PaymentReceipt.deleteMany({})
  ]);
  await redis.flushDb();

  const categories = await Category.insertMany(categoryDefinitions);
  const categoryMap = new Map(categories.map(category => [category.slug, category]));
  const foods = await Food.insertMany(catalog.map((item, index) => ({
    name: item.name,
    slug: `${item.category}-${index + 1}`,
    description: item.description,
    price: item.price,
    unit: item.unit,
    imageUrl: `/images/menu/${item.imageFile}`,
    category: categoryMap.get(item.category)._id,
    tags: item.tags,
    isAvailable: true,
    soldCount: Math.max(1, 50 - index)
  })));
  const passwordHash = await bcrypt.hash('123456', 11);
  const users = await User.insertMany([
    { fullName: 'Quản trị viên', email: 'admin@quanan.vn', phone: '0901111222', passwordHash, role: 'admin' },
    { fullName: 'Nhân viên phục vụ', email: 'staff@quanan.vn', phone: '0902222333', passwordHash, role: 'staff' },
    { fullName: 'Nhân viên bếp', email: 'bep@quanan.vn', phone: '0903333444', passwordHash, role: 'kitchen' },
    { fullName: 'Nhân viên thu ngân', email: 'thungan@quanan.vn', phone: '0904444555', passwordHash, role: 'cashier' },
    { fullName: 'Khách hàng demo', email: 'khach@quanan.vn', phone: '0988123456', passwordHash, role: 'customer' },
    { fullName: 'Nguyễn Văn An', email: 'an@quanan.vn', phone: '0912345678', passwordHash, role: 'customer' },
    { fullName: 'Trần Thị Bình', email: 'binh@quanan.vn', phone: '0977654321', passwordHash, role: 'customer' }
  ]);

  const tables = await DiningTable.insertMany([
    ...Array.from({ length: 8 }, (_, index) => ({ name: `T1-A${index + 1}`, area: 'Tầng 1 - Khu A', capacity: 4 })),
    ...Array.from({ length: 8 }, (_, index) => ({ name: `T1-B${index + 1}`, area: 'Tầng 1 - Khu B', capacity: index < 4 ? 4 : 6 })),
    ...Array.from({ length: 4 }, (_, index) => ({ name: `T2-A${index + 1}`, area: 'Tầng 2', capacity: 8 })),
    { name: 'VIP-01', area: 'Phòng VIP', capacity: 10, description: 'Phòng riêng có máy lạnh' },
    { name: 'VIP-02', area: 'Phòng VIP', capacity: 15, description: 'Phòng riêng dành cho tiệc' }
  ]);

  const now = new Date();
  await Promotion.insertMany([
    {
      name: 'Chào mừng khách mới', code: 'WELCOME10', description: 'Giảm 10% cho đơn từ 200.000đ',
      discountType: 'percent', discountValue: 10, minOrderValue: 200000, maxDiscount: 50000,
      startAt: new Date(now.getFullYear(), 0, 1), endAt: new Date(now.getFullYear() + 1, 11, 31), isActive: true
    },
    {
      name: 'Giảm 30.000đ', code: 'GIAM30K', description: 'Giảm 30.000đ cho đơn từ 300.000đ',
      discountType: 'fixed', discountValue: 30000, minOrderValue: 300000,
      startAt: new Date(now.getFullYear(), 0, 1), endAt: new Date(now.getFullYear() + 1, 11, 31), isActive: true
    }
  ]);

  await InventoryItem.insertMany([
    { name: 'Thịt bò', unit: 'kg', currentStock: 25, minimumStock: 8, supplier: 'Nhà cung cấp thịt bò' },
    { name: 'Gân bò', unit: 'kg', currentStock: 12, minimumStock: 4, supplier: 'Nhà cung cấp thịt bò' },
    { name: 'Bò viên', unit: 'kg', currentStock: 9, minimumStock: 3, supplier: 'Cơ sở bò viên' },
    { name: 'Rau ăn lẩu', unit: 'kg', currentStock: 7, minimumStock: 5, supplier: 'Chợ đầu mối' },
    { name: 'Mì vắt', unit: 'vắt', currentStock: 80, minimumStock: 20, supplier: 'Nhà cung cấp thực phẩm' },
    { name: 'Nước ngọt', unit: 'thùng', currentStock: 15, minimumStock: 5, supplier: 'Đại lý nước giải khát' }
  ]);
  const populatedFoods = await Food.find().populate('category');
  await syncCatalogGraph(categories.map(category => ({ id: category.id, name: category.name })), populatedFoods.map(food => ({
    id: food.id, name: food.name, price: food.price,
    category: { id: food.category.id, name: food.category.name }
  })));
  for (const food of foods) await redis.zAdd('leaderboard:foods', { score: food.soldCount, value: food.id });

  const sampleOrders = await Order.insertMany([
    {
      orderCode: 'OD-DEMO-001', customer: users[4]._id, status: 'completed', orderType: 'dine-in', tableNumber: 'T1-A1',
      items: [0, 25].map(index => ({ food: foods[index]._id, name: foods[index].name, price: foods[index].price, quantity: 1 })),
      subtotal: [0, 25].reduce((sum, index) => sum + foods[index].price, 0),
      totalAmount: [0, 25].reduce((sum, index) => sum + foods[index].price, 0), paymentStatus: 'paid', paymentMethod: 'cash',
      statusHistory: [{ status: 'completed' }]
    },
    {
      orderCode: 'OD-SEED-AN', customer: users[5]._id, status: 'completed', orderType: 'dine-in', tableNumber: 'T1-A2',
      items: [0, 6, 25].map(index => ({ food: foods[index]._id, name: foods[index].name, price: foods[index].price, quantity: 1 })),
      subtotal: [0, 6, 25].reduce((sum, index) => sum + foods[index].price, 0),
      totalAmount: [0, 6, 25].reduce((sum, index) => sum + foods[index].price, 0), paymentStatus: 'paid', paymentMethod: 'cash',
      statusHistory: [{ status: 'completed' }]
    },
    {
      orderCode: 'OD-SEED-BINH', customer: users[6]._id, status: 'completed', orderType: 'dine-in', tableNumber: 'T1-A3',
      items: [0, 7, 26].map(index => ({ food: foods[index]._id, name: foods[index].name, price: foods[index].price, quantity: 1 })),
      subtotal: [0, 7, 26].reduce((sum, index) => sum + foods[index].price, 0),
      totalAmount: [0, 7, 26].reduce((sum, index) => sum + foods[index].price, 0), paymentStatus: 'paid', paymentMethod: 'cash',
      statusHistory: [{ status: 'completed' }]
    }
  ]);
  await Promise.all(sampleOrders.map((order, index) => recordOrderGraph(users[index + 4], order)));

  await Reservation.create({
    reservationCode: 'RS-DEMO-001', customer: users[4]._id, customerName: users[4].fullName,
    phone: users[4].phone, reservedAt: new Date(Date.now() + 24 * 60 * 60 * 1000), guestCount: 4,
    table: tables[0]._id, areaPreference: 'Tầng 1', status: 'confirmed',
    statusHistory: [{ status: 'confirmed', changedBy: users[0]._id }]
  });
  // Booking tomorrow remains visible in the calendar but does not hold the physical table today.

  console.log('Seed completed');
  console.log('Admin: admin@quanan.vn / 123456');
  console.log('Customer: khach@quanan.vn / 123456');
  console.log('Staff: staff@quanan.vn / 123456');
  console.log('Kitchen: bep@quanan.vn / 123456');
  console.log('Cashier: thungan@quanan.vn / 123456');
}

seed().then(closeDatabases).catch(async error => {
  console.error(error);
  await closeDatabases();
  process.exit(1);
});

