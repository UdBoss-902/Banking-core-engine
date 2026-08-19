import { pool } from '../../config/database.js';

export interface CreateAccountParams {
  accountNumber: string;
  currency: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
}

export interface Account {
  id: string;
  accountNumber: string;
  currency: string;
  type: string;
  status: string;
  createdAt: string;
}

export class AccountService {
  async createAccount(params: CreateAccountParams): Promise<Account> {
    const { accountNumber, currency, type } = params;
    const client = await pool.connect();
    try {
      const query = `
        INSERT INTO accounts (account_number, currency, type)
        VALUES ($1, $2, $3)
        RETURNING id, account_number AS "accountNumber", currency, type, status, created_at AS "createdAt"
      `;
      const result = await client.query(query, [accountNumber, currency, type]);
      return result.rows[0];
    } catch (error: any) {
      if (error.code === '23505') {
        throw new Error(`Account number '${accountNumber}' already exists.`);
      }
      throw error;
    } finally {
      client.release();
    }
  }
}
