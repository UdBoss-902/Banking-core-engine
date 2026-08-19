# Banking Core Engine

A production-grade, high-throughput financial ledger engine built with **Node.js**, **TypeScript**, **PostgreSQL**, and **Redis**. Engineered with double-entry accounting guarantees, deterministic pessimistic row locking (`FOR UPDATE`), and atomic distributed idempotency locks to eliminate double-spend vulnerabilities and race conditions under high concurrency.

## ??? Core Capabilities

| Feature | Technical Implementation |
| :--- | :--- |
| **Double-Entry Accounting** | Every transaction balances debits and credits across immutable ledger entries. |
| **Concurrency Guard** | Lexicographically sorted pessimistic row locks (`FOR UPDATE`) prevent SQL deadlocks. |
| **Atomic Idempotency** | Redis `SET NX EX` prevents duplicate processing and stores cached HTTP 2xx responses for 24h. |
| **Sliding-Window Limiting**| Redis `ZSET` pipeline tracks IP rate limits dynamically over a rolling time window. |
| **Real-Time Auditability** | Derived wallet balances computed dynamically using `SUM(CREDIT) - SUM(DEBIT)`. |

---

## ?? Quick Start (Local Setup)

### 1. Environment Configuration

Create a `.env` file in the project root:

```env
PORT=3000
DATABASE_URL=postgres://postgres:your_password@localhost:5432/banking_core_dev
REDIS_URL=redis://default:your_redis_password@your_host:16453
2. Install & Start Development Server
Bash
# Install dependencies
npm install

# Start hot-reloading development server
npm run dev
The server will initialize on http://localhost:3000. You can access interactive Swagger documentation at http://localhost:3000/docs.

?? cURL API Usage Examples
1. Health Check
Bash
curl -X GET http://localhost:3000/health
2. Create User Account (LIABILITY)
Bash
curl -X POST http://localhost:3000/api/v1/accounts \
  -H "Content-Type: application/json" \
  -d '{
    "accountNumber": "ACC-USER-101",
    "currency": "USD",
    "type": "LIABILITY"
  }'
3. Create Bank Clearing Account (ASSET)
Bash
curl -X POST http://localhost:3000/api/v1/accounts \
  -H "Content-Type: application/json" \
  -d '{
    "accountNumber": "ACC-CLEARING-001",
    "currency": "USD",
    "type": "ASSET"
  }'
4. Post Atomic Double-Entry Transfer
Bash
curl -X POST http://localhost:3000/api/v1/transfers \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: IDEM-PAYMENT-8801" \
  -d '{
    "reference": "REF-PAYMENT-8801",
    "sourceAccountId": "<SOURCE_ACCOUNT_UUID>",
    "destinationAccountId": "<DESTINATION_ACCOUNT_UUID>",
    "amount": 250.00,
    "currency": "USD",
    "description": "P2P Payment"
  }'
5. Check Real-Time Derived Balance
Bash
curl -X GET http://localhost:3000/api/v1/accounts/<ACCOUNT_UUID>/balance
?? Docker & Production Deployment
Local Docker Build
Bash
# Build lightweight multi-stage image
docker build -t banking-core-engine .

# Run containerized service
docker run -p 3000:3000 --env-file .env banking-core-engine 

ARCHITECTUTAL DIAGRAM: 
┌─────────────────────────┐
                       │   Client / HTTP Request │
                       └────────────┬────────────┘
                                    │
                                    ▼
                       ┌─────────────────────────┐
                       │  Sliding-Window Limiter │ (Redis ZSET)
                       └────────────┬────────────┘
                                    │
                                    ▼
                       ┌─────────────────────────┐
                       │  Idempotency Lock (SET) │ (Redis SET NX)
                       └────────────┬────────────┘
                                    │
                                    ▼
                        Express HTTP Middleware
                                    │
                                    ▼
                       ┌─────────────────────────┐
                       │ Ledger Transaction      │
                       │ (BEGIN...COMMIT)        │
                       └────────────┬────────────┘
                                    │
             ┌──────────────────────┴──────────────────────┐
             ▼                                             ▼
  ┌──────────────────────┐                     ┌──────────────────────┐
  │ Account Locks        │                     │ Ledger Entries       │
  │ SELECT FOR UPDATE    │                     │ Debit / Credit Lines │
  └──────────────────────┘                     └──────────────────────┘
             │                                             │
             └──────────────────────┬──────────────────────┘
                                    │
                                    ▼
                         ┌────────────────────┐
                         │ Immutable Postgres │
                         │ Database           │
                         └────────────────────┘