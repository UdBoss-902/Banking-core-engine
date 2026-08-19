import app from './app.js';
import { pool } from './config/database.js';
import { redis } from './config/redis.js';

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`?? Banking Core Engine running on port ${PORT}`);
});

async function gracefulShutdown(signal: string) {
  console.log(`\n?? Received ${signal}. Initiating graceful shutdown...`);

  server.close(async () => {
    console.log('?? HTTP server closed.');
    try {
      await pool.end();
      console.log('?? PostgreSQL pool closed.');
      await redis.quit();
      console.log('?? Redis client disconnected.');
      process.exit(0);
    } catch (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
  });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
