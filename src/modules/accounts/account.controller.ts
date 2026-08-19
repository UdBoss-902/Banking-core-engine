import { Request, Response, NextFunction } from 'express';
import { pool } from '../../config/database.js';
import { LedgerService } from '../ledger/ledger.service.js';

const ledgerService = new LedgerService();

export async function createAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { userId, accountNumber, currency, type } = req.body;

  if (!accountNumber || !currency || !type) {
    res.status(400).json({ error: 'Missing required fields: accountNumber, currency, type.' });
    return;
  }

  try {
    const result = await pool.query(
      `INSERT INTO accounts (user_id, account_number, currency, type)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id, account_number, currency, type, status, created_at`,
      [userId || null, accountNumber, currency.toUpperCase(), type.toUpperCase()]
    );

    res.status(201).json({ success: true, account: result.rows[0] });
  } catch (error: any) {
    if (error.code === '23505') {
      res.status(409).json({ error: 'Account number already exists.' });
      return;
    }
    next(error);
  }
}

export async function getAccountBalance(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { accountId } = req.params;

  try {
    const balance = await ledgerService.getAccountBalance(accountId);
    res.status(200).json({ accountId, balance });
  } catch (error) {
    next(error);
  }
}
