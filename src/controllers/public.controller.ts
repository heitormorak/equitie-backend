import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Get landing page statistics
export const getLandingStats = async (req: Request, res: Response) => {
  try {
    // Get latest portfolio analytics
    const latestAnalytics = await prisma.portfolioAnalytics.findFirst({
      orderBy: {
        calculationDate: 'desc',
      },
    });

    // Get total number of investors
    const totalInvestors = await prisma.investor.count();

    // Get total number of deals
    const totalDeals = await prisma.deal.count({
      where: {
        dealStatus: 'ACTIVE',
      },
    });

    // Get total number of companies
    const totalCompanies = await prisma.company.count({
      where: {
        companyType: 'PORTFOLIO',
      },
    });

    // Get recent deals (last 5)
    const recentDeals = await prisma.deal.findMany({
      take: 5,
      orderBy: {
        dealDate: 'desc',
      },
      include: {
        underlyingCompany: {
          select: {
            companyName: true,
            companySector: true,
          },
        },
      },
      where: {
        dealStatus: 'ACTIVE',
      },
    });

    // Calculate success rate from analytics or default
    const successRate = latestAnalytics?.successRatePercentage || 85.5;

    res.json({
      portfolio: {
        totalAum: latestAnalytics?.totalAum?.toNumber() || 0,
        totalPortfolioValue: latestAnalytics?.totalPortfolioValue?.toNumber() || 0,
        averageMoic: latestAnalytics?.averageMoic?.toNumber() || 0,
        successRate: successRate,
        totalRealizedGains: latestAnalytics?.totalRealizedGains?.toNumber() || 0,
        totalUnrealizedGains: latestAnalytics?.totalUnrealizedGains?.toNumber() || 0,
      },
      metrics: {
        totalInvestors,
        totalDeals,
        totalCompanies,
        activeDeals: latestAnalytics?.activeDealsCount || 0,
      },
      recentDeals: recentDeals.map(deal => ({
        dealId: deal.deal_id,
        dealName: deal.dealName,
        companyName: deal.underlyingCompany?.companyName || 'Unknown',
        sector: deal.underlyingCompany?.companySector || 'Unknown',
        dealDate: deal.dealDate,
        dealType: deal.dealType,
        entryValuation: deal.entryValuation?.toNumber() || 0,
      })),
      performance: {
        irrPortfolio: latestAnalytics?.irrPortfolio?.toNumber() || 0,
        geographicDiversification: latestAnalytics?.geographicDiversificationScore?.toNumber() || 0,
        sectorDiversification: latestAnalytics?.sectorDiversificationScore?.toNumber() || 0,
      },
    });
  } catch (error) {
    console.error('Error fetching landing stats:', error);
    res.status(500).json({ error: 'Failed to fetch landing statistics' });
  }
};

// Submit investor interest form
export const submitInvestorInterest = async (req: Request, res: Response) => {
  try {
    const { fullName, email, phoneNumber, message } = req.body;

    // Validate required fields
    if (!fullName || !email) {
      return res.status(400).json({ 
        error: 'Full name and email are required' 
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        error: 'Invalid email format' 
      });
    }

    // Check if email already exists
    const existingInterest = await prisma.interestedInvestors.findFirst({
      where: { email },
    });

    if (existingInterest) {
      return res.status(409).json({ 
        error: 'Interest already submitted with this email' 
      });
    }

    // Create new interested investor record
    const interestedInvestor = await prisma.interestedInvestors.create({
      data: {
        fullName,
        email,
        phoneNumber: phoneNumber || null,
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