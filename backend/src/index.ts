import { createServer } from './server.js';
import { config } from './config/app.config.js';
import { logger } from './utils/logger.js';
import { initConfigStore, configStore } from './config/llm.config.js';

let isShuttingDown = false;

async function start() {
  try {
    // 初始化配置存储
    logger.info('Initializing configuration store...');
    await initConfigStore();
    logger.info('Configuration store initialized');

    const server = await createServer();

    await server.listen({
      port: config.server.port,
      host: config.server.host,
    });

    logger.info(`Server listening on http://${config.server.host}:${config.server.port}`);

    // ──────── Graceful Shutdown ────────
    const shutdown = async (signal: string) => {
      if (isShuttingDown) return;
      isShuttingDown = true;

      logger.info(`Received ${signal}, shutting down gracefully...`);

      // Stop accepting new connections
      try {
        await server.close();
        logger.info('HTTP server closed');
      } catch (err) {
        logger.error(err, 'Error closing HTTP server');
      }

      // Flush database to disk
      try {
        configStore.close();
        logger.info('Database closed');
      } catch (err) {
        logger.error(err, 'Error closing database');
      }

      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
}

// ──────── Global Error Handlers ────────
process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled Promise Rejection');
});

process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'Uncaught Exception — shutting down');
  process.exit(1);
});

start();
