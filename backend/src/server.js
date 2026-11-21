import app from './app.js';
import { env } from './config/env.js';
import { closeDatabases, connectDatabases } from './config/database.js';
import { ensureGraphConstraints } from './services/graph.js';
import { Food } from './models/Food.js';
import { restoreMenuCatalog } from './services/menuRestore.js';

async function start() {
  await connectDatabases();
  await ensureGraphConstraints();
  // On a first/fresh MongoDB volume the server had users/tables but no menu.
  // Restore KLCN foods only when no foods exist; never reset live orders/users.
  if (await Food.countDocuments() === 0) {
    const restored = await restoreMenuCatalog();
    console.log('Empty restaurant menu restored safely:', restored);
  }
  const server = app.listen(env.port, () => {
    console.log(`API listening at http://localhost:${env.port}`);
  });

  const shutdown = async () => {
    server.close();
    await closeDatabases();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch(error => {
  console.error('Cannot start application:', error);
  process.exit(1);
});

