import { pool } from '../../config/database.js';
import { PoolClient } from 'pg';

export interface RecordTransactionParams {
  reference: string;
  idempotencyKey: string;
  sourceAccountId: string;      // Account DEBITED (Liability decreases)
  destinationAccountId: string; // Account CREDITED (Liability increases)
  amount: number;               // Must be positive
  currency: string;
  description: string;
}

export interface AccountBalance {
  accountId: string;
  currency: string;
  balance: number;
}

export class LedgerService {
  /**
   * Calculates real-time balance from immutable ledger entries.
   * Balance = SUM(CREDIT) - SUM(DEBIT) for Liability accounts (wallets).
   */
  async getAccountBalance(accountId: string, client?: PoolClient): Promise<number> {
    const dbClient = client || (await pool.connect());
    try {
      const query = `
        SELECT COALESCE(
          SUM(CASE WHEN type = 'CREDIT' THEN amount ELSE -amount END), 0
        ) AS balance
        FROM ledger_entries
        WHERE account_id = $1
      `;
      const result = await dbClient.query(query, [accountId]);
      return parseFloat(result.rows[0].balance);
    } finally {
      if (!client) dbClient.release();
    }
  }

  /**
   * Posts an atomic double-entry transaction.
   * Executes inside an isolated SQL transaction block (BEGIN...COMMIT).
   */
  async postTransaction(params: RecordTransactionParams): Promise<{ journalId: string }> {
    const { reference, idempotencyKey, sourceAccountId, destinationAccountId, amount, currency, description } = params;

    if (amount <= 0) {
      throw new Error('Transaction amount must be greater than zero.');
    }

    if (sourceAccountId === destinationAccountId) {
      throw new Error('Source and destination accounts must be distinct.');
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Idempotency Check: Prevent duplicate transaction processing
      const existingJournal = await client.query(
        'SELECT id FROM journals WHERE idempotency_key = $1 OR reference = $2',
        [idempotencyKey, reference]
      );

      if (existingJournal.rows.length > 0) {
        await client.query('ROLLBACK');
        return { journalId: existingJournal.rows[0].id };
      }

      // 2. Deadlock Prevention: Lock accounts in deterministic order (lexicographical sorting)
      const sortedAccountIds = [sourceAccountId, destinationAccountId].sort();
      
      const accountsResult = await client.query(
        `SELECT id, currency, status 
         FROM accounts 
         WHERE id IN ($1, $2) 
         FOR UPDATE`,
        [sortedAccountIds[0], sortedAccountIds[1]]
      );

      if (accountsResult.rows.length !== 2) {
        throw new Error('One or both specified accounts do not exist.');
      }

      const sourceAccount = accountsResult.rows.find((acc) => acc.id === sourceAccountId);
      const destinationAccount = accountsResult.rows.find((acc) => acc.id === destinationAccountId);

      if (sourceAccount.status !== 'ACTIVE' || destinationAccount.status !== 'ACTIVE') {
        throw new Error('Both accounts must be active to complete a transfer.');
      }

      if (sourceAccount.currency !== currency || destinationAccount.currency !== currency) {
        throw new Error(`Currency mismatch. Transaction currency [${currency}] must match account currencies.`);
      }

      // 3. Balance Check: Calculate real-time source account balance within transaction block
      const sourceBalance = await this.getAccountBalance(sourceAccountId, client);
      if (sourceBalance < amount) {
        throw new Error(`Insufficient balance. Account [${sourceAccountId}] balance is ${sourceBalance}, requested ${amount}.`);
      }

      // 4. Create Journal Header
      const journalResult = await client.query(
        `INSERT INTO journals (reference, idempotency_key, description, status)
         VALUES ($1, $2, $3, 'POSTED')
         RETURNING id`,
        [reference, idempotencyKey, description]
      );
      const journalId = journalResult.rows[0].id;

      // 5. Create Debit Line Item (Source Account)
      await client.query(
        `INSERT INTO ledger_entries (journal_id, account_id, type, amount)
         VALUES ($1, $2, 'DEBIT', $3)`,
        [journalId, sourceAccountId, amount]
      );

      // 6. Create Credit Line Item (Destination Account)
      await client.query(
        `INSERT INTO ledger_entries (journal_id, account_id, type, amount)
         VALUES ($1, $2, 'CREDIT', $3)`,
        [journalId, destinationAccountId, amount]
      );

      await client.query('COMMIT');
      return { journalId };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
