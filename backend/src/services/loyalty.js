import { User } from '../models/User.js';

// The same atomic document update records the order and increments points.
// Replaying payment recovery never grants points twice (standalone MongoDB supported).
export async function rewardPaidOrders(orders) {
  for (const order of orders) {
    if (!order.customer) continue;
    await User.updateOne(
      { _id: order.customer, rewardedOrders: { $ne: order._id } },
      { $addToSet: { rewardedOrders: order._id }, $inc: { loyaltyPoints: Math.floor(order.totalAmount / 10000) } }
    );
  }
}
