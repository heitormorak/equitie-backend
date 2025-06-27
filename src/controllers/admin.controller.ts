import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// List all investors
export const listInvestors = async (req: Request, res: Response) => {
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
export const approveInvestor = async (req: Request, res: Response) => {
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
export const listDeals = async (req: Request, res: Response) => {
  try {
    const deals = await prisma.deal.findMany({
      include: {
        underlyingCompany: true,
        holdingEntityCompany: true,
      },
      orderBy: {
        dealDate: 'desc',
      },
    });

    res.json(deals);
  } catch (error) {
    console.error('Error fetching deals:', error);
    res.status(500).json({ error: 'Failed to fetch deals' });
  }
};

// Update company valuations
export const updateValuations = async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    const { valuationPostMoney, valuationPreMoney, investmentAmount, description } = req.body;

    const valuation = await prisma.valuation.create({
      data: {
        companyId: parseInt(companyId),
        valuationPostMoney,
        valuationPreMoney,
        investmentAmount,
        description,
        valuationDate: new Date(),
      },
    });

    res.json({ message: 'Valuation updated successfully', valuation });
  } catch (error) {
    console.error('Error updating valuation:', error);
    res.status(500).json({ error: 'Failed to update valuation' });
  }
}; 