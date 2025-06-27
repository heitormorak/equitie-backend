import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

// List all investors
export const listInvestors = async (req: Request, res: Response): Promise<void> => {
  try {
    const investors = await prisma.investor.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json(investors);
  } catch (error) {
    console.error('Error fetching investors:', error);
    res.status(500).json({ error: 'Failed to fetch investors' });
  }
};

// Approve an investor
export const approveInvestor = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const investor = await prisma.investor.update({
      where: { id: parseInt(id) },
      data: {
        id_checked: true,
      },
    });

    res.json({ message: 'Investor approved successfully', investor });
  } catch (error) {
    console.error('Error approving investor:', error);
    res.status(500).json({ error: 'Failed to approve investor' });
  }
};

// List all deals
export const listDeals = async (req: Request, res: Response): Promise<void> => {
  try {
    const deals = await prisma.deal.findMany({
      include: {
        underlying_company: true,
        holding_entity_company: true,
      },
      orderBy: {
        deal_date: 'desc',
      },
    });

    res.json(deals);
  } catch (error) {
    console.error('Error fetching deals:', error);
    res.status(500).json({ error: 'Failed to fetch deals' });
  }
};

// Update company valuations
export const updateValuations = async (req: Request, res: Response): Promise<void> => {
  try {
    const { companyId } = req.params;
    const { valuation_post_money, valuation_pre_money, investment_amount, description } = req.body;

    const valuation = await prisma.valuation.create({
      data: {
        company_id: parseInt(companyId),
        valuation_post_money: new Decimal(valuation_post_money),
        valuation_pre_money: new Decimal(valuation_pre_money),
        investment_amount: new Decimal(investment_amount),
        description: description,
        valuation_date: new Date(),
      } as any,
    });

    res.json({ message: 'Valuation updated successfully', valuation });
  } catch (error) {
    console.error('Error updating valuation:', error);
    res.status(500).json({ error: 'Failed to update valuation' });
  }
}; 