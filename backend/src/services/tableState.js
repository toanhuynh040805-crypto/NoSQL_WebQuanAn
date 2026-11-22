import { DiningTable } from '../models/DiningTable.js';
import { TableSession } from '../models/TableSession.js';
import { Reservation } from '../models/Reservation.js';
import { Order } from '../models/Order.js';

export async function refreshOrderTable(tableNumber) {
  if (!tableNumber) return;
  const table = await DiningTable.findOne({ name: tableNumber }).select('_id status');
  if (!table || ['inactive', 'cleaning'].includes(table.status)) return;
  const [activeSession, openOrder, reservation] = await Promise.all([
    TableSession.exists({ table: table._id, status: 'active' }),
    Order.exists({ tableNumber, status: { $ne: 'cancelled' }, $or: [{ status: { $ne: 'completed' } }, { paymentStatus: 'pending' }] }),
    Reservation.exists({ table: table._id, status: 'confirmed', reservedAt: { $gte: new Date(Date.now() - 1800000), $lte: new Date(Date.now() + 1800000) } })
  ]);
  await DiningTable.updateOne({ _id: table._id, status: { $nin: ['inactive', 'cleaning'] } }, { $set: { status: activeSession || openOrder ? 'occupied' : reservation ? 'reserved' : 'available' } });
}
