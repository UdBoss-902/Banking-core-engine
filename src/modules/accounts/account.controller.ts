import { Request, Response } from 'express';
import { AccountService } from './account.service.js';
import { LedgerService } from '../ledger/ledger.service.js';

const accountService = new AccountService();
const ledgerService = new LedgerService();

export const createAccount = async (req: Request, res: Response): Promise<void> => {
  try {
    const { accountNumber, currency, type } = req.body;
    if (!accountNumber || !currency || !type) {
      res.status(400).json({ error: 'Missing required account parameters: accountNumber, currency, type.' });
      return;
    }

    const account = await accountService.createAccount({ accountNumber, currency, type });
    res.status(201).json({ success: true, account });
  } catch (error: any) {
    if (error.message?.includes('already exists')) {
      res.status(409).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: error.message || 'Failed to create account.' });
  }
};

export const getAccountBalance = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawAccountId = req.params.accountId;
    const accountId = Array.isArray(rawAccountId) ? rawAccountId[0] : (rawAccountId as string);

    if (!accountId) {
      res.status(400).json({ error: 'Account ID is required.' });
      return;
    }

    const balance = await ledgerService.getAccountBalance(accountId);
    res.status(200).json({ accountId, balance });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to retrieve account balance.' });
  }
};
