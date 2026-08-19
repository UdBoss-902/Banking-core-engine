import express from 'express';
import { idempotencyMiddleware } from './middleware/idempotency.middleware.js';
import { createRateLimiter } from './middleware/rateLimiter.middleware.js';
import { createAccount, getAccountBalance } from './modules/accounts/account.controller.js';
import { processTransfer } from './modules/transfers/transfer.controller.js';

const app = express();

app.use(express.json());

// Global Rate Limiter: 100 requests per 15 minutes per IP
app.use(createRateLimiter({ windowMs: 15 * 60 * 1000, maxRequests: 100 }));

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', timestamp: new Date().toISOString() });
});

// Accounts API
app.post('/api/v1/accounts', createAccount);
app.get('/api/v1/accounts/:accountId/balance', getAccountBalance);

// Transfers API (Protected by Redis-backed Atomic Idempotency)
app.post('/api/v1/transfers', idempotencyMiddleware, processTransfer);

export default app;
