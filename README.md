A production-grade, high-throughput financial ledger engine built with **Node.js**, **TypeScript**, **PostgreSQL**, and **Redis**. Engineered with double-entry accounting guarantees, deterministic pessimistic row locking (`FOR UPDATE`), and atomic distributed idempotency locks to eliminate double-spend vulnerabilities and race conditions under high concurrency.

---

## 🌐 Live Interactive Testing Dashboard

You can test all endpoints directly in your browser without installing dependencies or local setup:

👉 **[Live Swagger UI Documentation](https://banking-core-engine.onrender.com/docs)**

## 🛠️ Core Capabilities

| Feature | Technical Implementation |
| :--- | :--- |
| **Double-Entry Accounting** | Every transaction balances debits and credits across immutable ledger entries. |
| **Concurrency Guard** | Lexicographically sorted pessimistic row locks (`FOR UPDATE`) prevent SQL deadlocks. |
| **Atomic Idempotency** | Redis `SET NX EX` prevents duplicate processing and stores cached HTTP 2xx responses for 24h. |
| **Sliding-Window Limiting**| Redis `ZSET` pipeline tracks IP rate limits dynamically over a rolling time window. |
| **Real-Time Auditability** | Derived wallet balances computed dynamically using `SUM(CREDIT) - SUM(DEBIT)`. |

---

## 🧪 Live cURL API Testing Commands

## 1. System Health Check
curl -X GET [https://banking-core-engine.onrender.com/health](https://banking-core-engine.onrender.com/health) ?

## 2. Create User Wallet Account(Liability)
curl -X POST [https://banking-core-engine.onrender.com/api/v1/accounts](https://banking-core-engine.onrender.com/api/v1/accounts) \
  -H "Content-Type: application/json" \
  -d '{
    "accountNumber": "ACC-USER-101",
    "currency": "USD",
    "type": "LIABILITY"
  }'

  ## 3. Create Bank Reserve Account(Asset)
  curl -X POST [https://banking-core-engine.onrender.com/api/v1/accounts](https://banking-core-engine.onrender.com/api/v1/accounts) \
  -H "Content-Type: application/json" \
  -d '{
    "accountNumber": "ACC-CLEARING-001",
    "currency": "USD",
    "type": "ASSET"
  }'

  ## 4. Post Atomic Double Entry Transfer
  curl -X POST [https://banking-core-engine.onrender.com/api/v1/transfers](https://banking-core-engine.onrender.com/api/v1/transfers) \
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

  ## 5. Check Real-Time Derived Balance
  curl -X GET [https://banking-core-engine.onrender.com/api/v1/accounts/](https://banking-core-engine.onrender.com/api/v1/accounts/)<ACCOUNT_UUID>/balance


  ## Local Setup and Deplopment
  # Clone and install dependencies
git clone [https://github.com/UdBoss-902/Banking-core-engine.git](https://github.com/UdBoss-902/Banking-core-engine.git)
cd Banking-core-engine
npm install

# Start development server
npm run dev