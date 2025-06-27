import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Get landing page statistics
export const getLandingStats = async (req: Request, res: Response): Promise<void> => {
  try {
    // Get latest portfolio analytics
    const latestAnalytics = await prisma.portfolioAnalytics.findFirst({
      orderBy: {
        calculation_date: 'desc',
      },
    });

    // Get total number of investors
    const totalInvestors = await prisma.investor.count();

    // Get total number of deals
    const totalDeals = await prisma.deal.count({
      where: {
        deal_status: 'ACTIVE',
      },
    });

    // Get total number of companies
    const totalCompanies = await prisma.company.count({
      where: {
        company_type: 'PORTFOLIO',
      },
    });

    // Get recent deals (last 5)
    const recentDeals = await prisma.deal.findMany({
      take: 5,
      orderBy: {
        deal_date: 'desc',
      },
      include: {
        underlying_company: {
          select: {
            company_name: true,
            company_sector: true,
          },
        },
      },
      where: {
        deal_status: 'ACTIVE',
      },
    });

    // Calculate success rate from analytics or default
    const successRate = latestAnalytics?.success_rate_percentage || 85.5;

    res.json({
      portfolio: {
        totalAum: latestAnalytics?.total_aum?.toNumber() || 0,
        totalPortfolioValue: latestAnalytics?.total_portfolio_value?.toNumber() || 0,
        averageMoic: latestAnalytics?.average_moic?.toNumber() || 0,
        successRate: successRate,
        totalRealizedGains: latestAnalytics?.total_realized_gains?.toNumber() || 0,
        totalUnrealizedGains: latestAnalytics?.total_unrealized_gains?.toNumber() || 0,
      },
      metrics: {
        totalInvestors,
        totalDeals,
        totalCompanies,
        activeDeals: latestAnalytics?.active_deals_count || 0,
      },
      recentDeals: recentDeals.map(deal => ({
        dealId: deal.id,
        dealName: deal.deal_name,
        companyName: deal.underlying_company?.company_name || 'Unknown',
        sector: deal.underlying_company?.company_sector || 'Unknown',
        dealDate: deal.deal_date,
        dealType: deal.deal_type,
        entryValuation: deal.entry_valuation?.toNumber() || 0,
      })),
      performance: {
        irrPortfolio: latestAnalytics?.irr_portfolio?.toNumber() || 0,
        geographicDiversification: latestAnalytics?.geographic_diversification_score?.toNumber() || 0,
        sectorDiversification: latestAnalytics?.sector_diversification_score?.toNumber() || 0,
      },
    });
  } catch (error) {
    console.error('Error fetching landing stats:', error);
    res.status(500).json({ error: 'Failed to fetch landing statistics' });
  }
};

// Submit investor interest form
export const submitInvestorInterest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { fullName, email, phoneNumber, message } = req.body;

    // Validate required fields
    if (!fullName || !email) {
      res.status(400).json({ 
        error: 'Full name and email are required' 
      });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ 
        error: 'Invalid email format' 
      });
      return;
    }

    // Check if email already exists
    const existingInterest = await prisma.interestedInvestor.findFirst({
      where: { email },
    });

    if (existingInterest) {
      res.status(409).json({ 
        error: 'Interest already submitted with this email' 
      });
      return;
    }

    // Create new interested investor record
    const interestedInvestor = await prisma.interestedInvestor.create({
      data: {
        full_name: fullName,
        email,
        phone_number: phoneNumber || null,
        message: message || null,
        status: 'NEW',
      },
    });

   
    // 1. Send confirmation email
    // 2. Notify admin team
    // 3. Add to CRM system
    // 4. Send welcome materials

    res.status(201).json({
      message: 'Interest submitted successfully',
      id: interestedInvestor.id,
      status: interestedInvestor.status,
    });
  } catch (error) {
    console.error('Error submitting investor interest:', error);
    res.status(500).json({ error: 'Failed to submit interest' });
  }
}; 