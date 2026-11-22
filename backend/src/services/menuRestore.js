import { Category } from '../models/Category.js';
import { Food } from '../models/Food.js';
import { catalog, categoryDefinitions } from '../data/menuCatalog.js';
import { clearMenuCache } from './cache.js';
import { syncCatalogGraph } from './graph.js';

// Safe, additive-only catalog recovery. Never touches users, orders, sessions,
// payments, reservations or edits to existing dishes.
export async function restoreMenuCatalog() {
  let categoriesAdded = 0;
  let foodsAdded = 0;
  for (const category of categoryDefinitions) {
    const { slug, ...inserted } = category;
    const result = await Category.updateOne(
      { slug }, { $setOnInsert: inserted }, { upsert: true }
    );
    if (result.upsertedCount) categoriesAdded++;
  }
  const categories = await Category.find({
    slug: { $in: categoryDefinitions.map(category => category.slug) }
  }).lean();
  const bySlug = new Map(categories.map(category => [category.slug, category]));
  const slugs = [];
  for (const [index, food] of catalog.entries()) {
    const slug = food.category + '-' + (index + 1);
    const category = bySlug.get(food.category);
    if (!category) throw new Error('Thiếu nhóm món KLCN: ' + food.category);
    const { category: _category, imageFile, ...menuData } = food;
    const result = await Food.updateOne(
      { slug },
      { $setOnInsert: {
        ...menuData, imageUrl: '/images/menu/' + imageFile,
        category: category._id, isAvailable: true,
        soldCount: Math.max(1, 50 - index)
      } },
      { upsert: true }
    );
    if (result.upsertedCount) foodsAdded++;
    slugs.push(slug);
  }

  // The menu may already have been cached as an empty array.
  await clearMenuCache();

  // Graph data is supplementary; MongoDB is the source of truth.
  // A Neo4j problem must not hide an otherwise recoverable menu.
  let graphUpdated = true;
  try {
    const foods = await Food.find({ slug: { $in: slugs } })
      .populate('category', 'name').lean();
    await syncCatalogGraph(
      categories.map(category => ({ id: String(category._id), name: category.name })),
      foods.filter(food => food.category).map(food => ({
        id: String(food._id), name: food.name, price: food.price,
        category: { id: String(food.category._id), name: food.category.name }
      }))
    );
  } catch (error) {
    graphUpdated = false;
    console.warn('[restore:menu] Neo4j sync skipped:', error.message);
  }
  return {
    categoriesAdded, foodsAdded, graphUpdated,
    totalCategories: categoryDefinitions.length, totalCatalogItems: catalog.length
  };
}
