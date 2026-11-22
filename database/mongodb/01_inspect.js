// READ ONLY. Run with: Get-Content -Raw .\database\mongodb\01_inspect.js | docker exec -i restaurant-mongodb mongosh restaurant_nosql --quiet
print('MongoDB demo database:', db.getName());
const collections = db.getCollectionNames().sort();
print('COLLECTIONS', EJSON.stringify(collections));
for (const name of ['users','categories','foods','orders','reviews','diningtables','tablesessions','reservations','paymentreceipts']) {
  print(name + ':', db.getCollection(name).countDocuments({}));
}
print('FOODS (sample without IDs):');
printjson(db.foods.find({}, { _id: 0, name: 1, price: 1, isAvailable: 1 }).limit(5).toArray());
print('ORDERS (sample without customer information):');
printjson(db.orders.find({}, { _id: 0, orderCode: 1, status: 1, paymentStatus: 1, totalAmount: 1 }).limit(5).toArray());
print('ORDER STATUS GROUPS:');
printjson(db.orders.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }, { $sort: { count: -1 } }]).toArray());
