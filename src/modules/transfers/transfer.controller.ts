import { Request, Response, NextFunction } from 'express';
import { LedgerService } from '../ledger/ledger.service.js';

const ledgerService = new LedgerService();

export async function processTransfer(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { reference, sourceAccountId, destinationAccountId, amount, currency, description } = req.body;
  const idempotencyKey = (req.headers['idempotency-key'] || req.headers['x-idempotency-key']) as string;

  if (!reference || !sourceAccountId || !destinationAccountId || !amount || !currency) {
    res.status(400).json({
      error: 'Missing required transfer parameters: reference, sourceAccountId, destinationAccountId, amount, currency.',
    });
    return;
  }

  try {
    const result = await ledgerService.postTransaction({
      reference,
      idempotencyKey,
      sourceAccountId,
      destinationAccountId,
      amount: parseFloat(amount),
      currency: currency.toUpperCase(),
      description: description || 'P2P Transfer',
    });

    res.status(201).json({
      success: true,
      message: 'Transaction posted successfully.',
      journalId: result.journalId,
      reference,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Transfer processing failed.' });
  }
}
