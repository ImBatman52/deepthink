import { FastifyInstance } from 'fastify';

const startedAt = Date.now();

export async function healthRoutes(fastify: FastifyInstance) {
  // Basic liveness probe
  fastify.get('/health', async () => {
    return {
      status: 'healthy',
      version: '1.0.0',
      timestamp: Date.now(),
      uptime: Math.floor((Date.now() - startedAt) / 1000),
    };
  });

  // Detailed readiness probe (for load balancers / k8s)
  fastify.get('/health/ready', async () => {
    const mem = process.memoryUsage();
    return {
      status: 'ready',
      version: '1.0.0',
      timestamp: Date.now(),
      uptime: Math.floor((Date.now() - startedAt) / 1000),
      memory: {
        heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
        rssMB: Math.round(mem.rss / 1024 / 1024),
      },
      node: process.version,
    };
  });
}
