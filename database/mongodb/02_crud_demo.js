// COURSE EXERCISE ONLY: modifies the isolated 'nosql_course_examples' collection.
// Does not edit restaurant orders, accounts, tables, receipts or foods.
const examples = db.getCollection('nosql_course_examples');
examples.createIndex({ exampleCode: 1 }, { unique: true });
const code = 'NOSQL-COURSE-EX-001';
// CREATE (idempotent upsert)
examples.updateOne({ exampleCode: code }, { $set: {
  category: 'food', name: 'Món mẫu lớp NoSQL', price: 25000, demoOnly: true,
  updatedAt: new Date()
} }, { upsert: true });
print('CREATE / READ:');
printjson(examples.findOne({ exampleCode: code }, { _id: 0 }));
// UPDATE
examples.updateOne({ exampleCode: code }, { $set: { price: 27000, updatedAt: new Date() } });
print('UPDATE:');
printjson(examples.findOne({ exampleCode: code }, { _id: 0 }));
// SEARCH / AGGREGATE
print('FIND:', examples.find({ demoOnly: true, price: { $gte: 20000 } }).count());
print('AGGREGATE:');
printjson(examples.aggregate([{ $match: { demoOnly: true } }, { $group: { _id: '$category', averagePrice: { $avg: '$price' }, count: { $sum: 1 } } }]).toArray());
// DELETE: remove only the isolated record created for the course exercise.
examples.deleteOne({ exampleCode: code });
print('DELETE COUNT:', examples.countDocuments({ exampleCode: code }));
