import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import { DeepThinkEngine } from '../services/deepthink/DeepThinkEngine.js';
import { logger } from '../utils/logger.js';

// Pre-serialized pong response (avoid JSON.stringify on every ping)
const PONG_MSG = JSON.stringify({ type: 'pong' });

/** Maximum allowed incoming message size (1MB) to prevent abuse */
const MAX_MESSAGE_SIZE = 1 * 1024 * 1024;

/** Safe JSON send helper — silently drops if socket is not open */
function safeSend(socket: WebSocket, payload: object): void {
  if (socket.readyState === 1) {
    try {
      socket.send(JSON.stringify(payload));
    } catch {
      // connection may have closed between readyState check and send
    }
  }
}

export function setupWebSocket(fastify: FastifyInstance) {
  fastify.get('/ws/chat', { websocket: true }, (socket: WebSocket, req) => {
    logger.info('WebSocket connection established');

    let isProcessing = false;
    let currentEngine: DeepThinkEngine | null = null;

    socket.on('message', async (message) => {
      try {
        const msgStr = message.toString();

        // Guard: reject oversized messages
        if (msgStr.length > MAX_MESSAGE_SIZE) {
          safeSend(socket, { type: 'error', message: 'Message too large' });
          return;
        }

        logger.debug({ raw: msgStr.substring(0, 200) }, 'Raw message received');

        let data: any;
        try {
          data = JSON.parse(msgStr);
        } catch {
          safeSend(socket, { type: 'error', message: 'Invalid JSON' });
          return;
        }

        // 忽略 ping 消息
        if (data.type === 'ping') {
          socket.send(PONG_MSG);
          return;
        }

        // Cancel command: abort current generation
        if (data.type === 'cancel') {
          if (currentEngine) {
            currentEngine.abort();
            logger.info('Generation cancelled by client');
          }
          return;
        }

        // 如果正在处理中，忽略新消息
        if (isProcessing) {
          safeSend(socket, { type: 'error', message: 'Already processing a query. Please wait or send cancel.' });
          return;
        }

        const query = typeof data.query === 'string' ? data.query.trim() : '';

        if (!query) {
          safeSend(socket, { type: 'error', message: 'Empty query' });
          return;
        }

        // Guard: reject excessively long queries
        if (query.length > 50_000) {
          safeSend(socket, { type: 'error', message: 'Query too long (max 50,000 characters)' });
          return;
        }

        logger.info({ query: query.substring(0, 100) }, 'Received query');

        isProcessing = true;
        const engine = new DeepThinkEngine();
        currentEngine = engine;

        try {
          // 构建配置，只包含有值的字段（避免 undefined 覆盖数据库配置）
          const streamConfig: any = { maxRounds: data.maxRounds || 1 };
          if (data.model) streamConfig.defaultModel = data.model;
          if (data.apiKey) streamConfig.apiKey = data.apiKey;
          if (data.baseUrl) streamConfig.baseUrl = data.baseUrl;
          if (data.fileContext) streamConfig.fileContext = data.fileContext;

          // 流式执行
          for await (const update of engine.stream(query, streamConfig)) {
            if (socket.readyState !== 1) {
              logger.info('WebSocket closed, aborting engine');
              engine.abort();
              break;
            }

            if (update.type === 'node_start') {
              safeSend(socket, {
                type: 'state_update',
                node: update.node,
                status: 'started',
                data: update.data || {},
              });
            } else if (update.type === 'expert_complete') {
              safeSend(socket, {
                type: 'expert_complete',
                data: update.data,
              });
            } else if (update.type === 'node_complete') {
              const nodeCompleteData: any = {
                type: 'state_update',
                node: update.node,
                status: 'completed',
              };
              // 搜索节点完成时发送搜索结果
              if (update.node === 'search' && update.state?.searchResults) {
                nodeCompleteData.searchResults = update.state.searchResults;
              }
              safeSend(socket, nodeCompleteData);
            } else if (update.type === 'complete') {
              safeSend(socket, {
                type: 'complete',
                data: {
                  final_output: update.state?.finalOutput,
                  experts: update.state?.expertsOutput,
                  searchResults: update.state?.searchResults,
                },
              });
            }
          }
        } finally {
          isProcessing = false;
          currentEngine = null;
        }
      } catch (error: any) {
        logger.error({ err: error }, 'WebSocket message handler error');
        safeSend(socket, {
          type: 'error',
          message: error.message || 'Unknown error',
        });
        isProcessing = false;
        currentEngine = null;
      }
    });

    socket.on('close', () => {
      logger.info('WebSocket connection closed');
      // Abort any in-flight generation when client disconnects
      if (currentEngine) {
        currentEngine.abort();
        currentEngine = null;
      }
    });

    socket.on('error', (error) => {
      logger.error({ err: error }, 'WebSocket connection error');
    });
  });
}
