import { connectDatabases, closeDatabases } from '../config/database.js';
import { restoreMenuCatalog } from '../services/menuRestore.js';

try {
  await connectDatabases();
  const result = await restoreMenuCatalog();
  console.log('[restore:menu] Đã đồng bộ thực đơn KLCN mà không xóa dữ liệu khác:', result);
} catch (error) {
  console.error('[restore:menu] Không thể khôi phục thực đơn:', error);
  process.exitCode = 1;
} finally {
  await closeDatabases();
}
