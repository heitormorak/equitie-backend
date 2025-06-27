import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

// Helper function to calculate deal metrics (reusable logic)
async function calculateDealMetrics(transaction: any) {
  const deal = transaction.deal;
  const investorInvestment = transaction.initial_net_capital || new Decimal(0);
  
  // Check how many companies are associated with this deal
  const dealCompanyInvestments = deal.deal_company_investments;
  const isMultipleCompanies = dealCompanyInvestments.length > 1;

  let dealCurrentValue = new Decimal(0);
  let dealInvested = investorInvestment;
  const companySummaries = [];

  if (isMultipleCompanies) {
    // Deal with multiple companies - use DealCompanyInvestment
    let totalDealInvestment = new Decimal(0);
    
    // Calculate total invested in the deal (sum of all investment_amount)
    dealCompanyInvestments.forEach(dci => {
      totalDealInvestment = totalDealInvestment.plus(dci.investment_amount);
    });

    for (const dci of dealCompanyInvestments) {
      const company = dci.company;
      const companyInvestmentAmount = dci.investment_amount;
      const entryValuation = dci.entry_valuation;
      
      // Calculate this company's proportion in the total deal
      const companyProportion = totalDealInvestment.gt(0) 
        ? companyInvestmentAmount.div(totalDealInvestment) 
        : new Decimal(0);
      
      // Calculate how much of the investor's investment goes to this company
      const investorInvestmentInCompany = investorInvestment.mul(companyProportion);
      
      // Get the latest valuation for the company
      const latestValuation = await prisma.valuation.findFirst({
        where: { company_id: company.id },
        orderBy: { valuation_date: 'desc' },
      });

      let moic = new Decimal(1);
      let currentValue = investorInvestmentInCompany;

      if (latestValuation && entryValuation.gt(0)) {
        moic = latestValuation.valuation_post_money.div(entryValuation);
        currentValue = investorInvestmentInCompany.mul(moic);
      } else if (latestValuation && entryValuation.eq(0)) {
        // If entry_valuation is 0 but latest valuation exists, keep investment as base
      }

      dealCurrentValue = dealCurrentValue.plus(currentValue);

      companySummaries.push({
        companyName: company.company_name,
        currentValue: currentValue.toNumber(),
        investedAmount: investorInvestmentInCompany.toNumber(),
        moic: moic.toNumber(),
        entryValuation: entryValuation.toNumber(),
        latestValuation: latestValuation?.valuation_post_money.toNumber() || null,
        latestValuationDate: latestValuation?.valuation_date || null,
      });
    }

  } else {
    // Deal with one company - check if it has deal_company_investments or underlying_company_id
    let company = null;
    let entryValuation = new Decimal(0);
    
    // First check if there are deal_company_investments
    if (dealCompanyInvestments.length === 1) {
      const dci = dealCompanyInvestments[0];
      company = dci.company;
      entryValuation = dci.entry_valuation;
    } else if (deal.underlying_company_id) {
      // If no deal_company_investments, check underlying_company_id
      company = await prisma.company.findUnique({
        where: { id: deal.underlying_company_id }
      });
      entryValuation = deal.entry_valuation || new Decimal(0);
    } else {
      // If neither exists, check deals_underlying_companies
      const dealCompanies = deal.deals_underlying_companies;
      if (dealCompanies.length > 0) {
        company = dealCompanies[0].company;
        entryValuation = deal.entry_valuation || new Decimal(0);
      }
    }
    
    if (company) {
      // Get the latest valuation for the company
      const latestValuation = await prisma.valuation.findFirst({
        where: { company_id: company.id },
        orderBy: { valuation_date: 'desc' },
      });

      let moic = new Decimal(1);
      let currentValue = investorInvestment;

      if (latestValuation && entryValuation.gt(0)) {
        moic = latestValuation.valuation_post_money.div(entryValuation);
        currentValue = investorInvestment.mul(moic);
      } else if (latestValuation && entryValuation.eq(0)) {
        // If entry_valuation is 0 but latest valuation exists, keep investment as base
      }

      dealCurrentValue = currentValue;

      companySummaries.push({
        companyName: company.company_name,
        currentValue: currentValue.toNumber(),
        investedAmount: investorInvestment.toNumber(),
        moic: moic.toNumber(),
        entryValuation: entryValuation.toNumber(),
        latestValuation: latestValuation?.valuation_post_money.toNumber() || null,
        latestValuationDate: latestValuation?.valuation_date || null,
      });
    } else {
      // Even without company, we should count the investment
      dealCurrentValue = investorInvestment; // Assume it maintains value if no valuation
    }
  }

  const dealMoic = dealInvested.gt(0) ? dealCurrentValue.div(dealInvested) : new Decimal(1);

  return {
    dealCurrentValue,
    dealInvested,
    dealMoic,
    companySummaries,
    isMultipleCompanies
  };
}

// Helper function to calculate portfolio totals
function calculatePortfolioTotals(transactions: any[], dealMetrics: any[]) {
  let totalInvested = new Decimal(0);
  let totalCurrentValue = new Decimal(0);
  let firstInvestmentDate: Date | null = null;

  for (let i = 0; i < transactions.length; i++) {
    const transaction = transactions[i];
    const metrics = dealMetrics[i];
    
    totalInvested = totalInvested.plus(metrics.dealInvested);
    totalCurrentValue = totalCurrentValue.plus(metrics.dealCurrentValue);

    if (!firstInvestmentDate || transaction.transaction_date < firstInvestmentDate) {
      firstInvestmentDate = transaction.transaction_date;
    }
  }

  const totalMoic = totalInvested.gt(0) ? totalCurrentValue.div(totalInvested) : new Decimal(0);
  const totalReturnPercent = totalInvested.gt(0)
    ? totalCurrentValue.minus(totalInvested).div(totalInvested).mul(100)
    : new Decimal(0);

  return {
    totalInvested,
    totalCurrentValue,
    totalMoic,
    totalReturnPercent,
    firstInvestmentDate
  };
}

// Get investor portfolio overview
export const getInvestorPortfolio = async (req: Request, res: Response): Promise<void> => {
  try {
    const investorId = parseInt(req.query.investorId as string) || parseInt(req.body.investorId as string);
    
    if (!investorId || isNaN(investorId)) {
      res.status(400).json({ error: 'investorId is required and must be a valid number' });
      return;
    }

    // Identify all deals that the investor invested in
    const transactions = await prisma.transaction.findMany({
      where: { investor_id: investorId },
      include: { 
        deal: {
          include: {
            deals_underlying_companies: {
              include: {
                company: true
              }
            },
            deal_company_investments: {
              include: {
                company: true
              }
            }
          }
        }
      },
    });

    const dealMetrics = [];
    const investmentsWithMetrics = [];

    for (const transaction of transactions) {
      const deal = transaction.deal;
      const metrics = await calculateDealMetrics(transaction);
      dealMetrics.push(metrics);

      investmentsWithMetrics.push({
        dealId: deal.id,
        dealName: deal.deal_name,
        companyNames: metrics.companySummaries.map(c => c.companyName).join(', '),
        currentValue: metrics.dealCurrentValue.toNumber(),
        investedAmount: metrics.dealInvested.toNumber(),
        dealDate: deal.deal_date,
        moic: metrics.dealMoic.toNumber(),
        dealType: deal.deal_type,
        dealStatus: deal.deal_status,
        isMultipleCompanyDeal: metrics.isMultipleCompanies,
        companies: metrics.companySummaries,
      });
    }

    const portfolioTotals = calculatePortfolioTotals(transactions, dealMetrics);

    res.json({
      portfolio: {
        currentValue: portfolioTotals.totalCurrentValue.toNumber(),
        totalReturnPercent: portfolioTotals.totalReturnPercent.toNumber(),
        moic: portfolioTotals.totalMoic.toNumber(),
        firstInvestmentDate: portfolioTotals.firstInvestmentDate,
        totalInvested: portfolioTotals.totalInvested.toNumber(),
        capitalEarned: portfolioTotals.totalCurrentValue.minus(portfolioTotals.totalInvested).toNumber(),
      },
      investments: investmentsWithMetrics,
    });
  } catch (error) {
    console.error('Error fetching portfolio:', error);
    res.status(500).json({ error: 'Failed to fetch portfolio' });
  }
};

// Get investment details for a specific deal
export const getInvestmentDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const investorId = parseInt(req.query.investorId as string) || parseInt(req.body.investorId as string);
    
    if (!investorId || isNaN(investorId)) {
      res.status(400).json({ error: 'investorId is required and must be a valid number' });
      return;
    }
    
    const { dealId } = req.params;

    const investment = await prisma.transaction.findFirst({
      where: {
        investor_id: investorId,
        deal_id: parseInt(dealId),
      },
      include: {
        deal: {
          include: {
            deal_company_investments: {
              include: {
                company: true,
              },
            },
          },
        },
      },
    });

    if (!investment) {
      res.status(404).json({ error: 'Investment not found' });
      return;
    }

    // Get latest valuations for all companies in the deal
    const companyIds = investment.deal.deal_company_investments.map(dci => dci.company_id);
    const latestValuations = await prisma.valuation.findMany({
      where: {
        company_id: { in: companyIds },
      },
      orderBy: {
        valuation_date: 'desc',
      },
      distinct: ['company_id'],
    });

    // Calculate fees
    const managementFee = investment.management_fee_percent 
      ? investment.initial_net_capital!.mul(investment.management_fee_percent).div(100)
      : new Decimal(0);

    const performanceFee = investment.performance_fee_percent
      ? investment.initial_net_capital!.mul(investment.performance_fee_percent).div(100)
      : new Decimal(0);

    // Determine if this is a single or multiple company deal
    const isSingleCompanyDeal = investment.deal.deal_company_investments.length === 1;

    // Calculate total current value and MOIC for all companies
    let totalCurrentValue = new Decimal(0);
    let totalInvestedInCompanies = new Decimal(0);
    const companies = [];

    for (const dealCompanyInvestment of investment.deal.deal_company_investments) {
      const company = dealCompanyInvestment.company;
      const companyInvestmentAmount = dealCompanyInvestment.investment_amount;
      
      // Determine entry valuation based on deal type
      let entryValuation: Decimal;
      if (isSingleCompanyDeal) {
        // Single company deal - use deal's entry_valuation
        entryValuation = investment.deal.entry_valuation || new Decimal(0);
      } else {
        // Multiple companies deal - use entry_valuation from deal_company_investments
        entryValuation = dealCompanyInvestment.entry_valuation;
      }
      
      const latestValuation = latestValuations.find(v => v.company_id === company.id);
      
      if (latestValuation && entryValuation.gt(0)) {
        const moic = latestValuation.valuation_post_money.div(entryValuation);
        const currentValue = companyInvestmentAmount.mul(moic);
        totalCurrentValue = totalCurrentValue.plus(currentValue);
        totalInvestedInCompanies = totalInvestedInCompanies.plus(companyInvestmentAmount);

        companies.push({
          companyName: company.company_name,
          sector: company.company_sector,
          description: company.company_description,
          entryValuation: entryValuation.toNumber(),
          latestValuation: latestValuation.valuation_post_money.toNumber(),
          currentValue: currentValue.toNumber(),
          investedAmount: companyInvestmentAmount.toNumber(),
          moic: moic.toNumber(),
        });
      }
    }

    const totalMoic = totalInvestedInCompanies.gt(0) ? totalCurrentValue.div(totalInvestedInCompanies) : new Decimal(0);

    res.json({
      investment: {
        dealId: investment.deal_id,
        currentValue: totalCurrentValue.toNumber(),
        investedAmount: investment.initial_net_capital!.toNumber(),
        dealDate: investment.deal.deal_date,
        moic: totalMoic.toNumber(),
        dealType: investment.deal.deal_type,
        dealStatus: investment.deal.deal_status,
      },
      companies,
      deal: {
        fundVehicle: investment.deal.deal_type,
        partner: investment.deal.deal_partner_name,
        description: investment.deal.description,
        numberOfCompanies: investment.deal.deal_company_investments.length,
        isSingleCompanyDeal,
      },
      fees: {
        managementFee: managementFee.toNumber(),
        performanceFee: performanceFee.toNumber(),
        totalFees: managementFee.plus(performanceFee).toNumber(),
      },
    });
  } catch (error) {
    console.error('Error fetching investment details:', error);
    res.status(500).json({ error: 'Failed to fetch investment details' });
  }
};

// Get portfolio overview (summary) - now uses the same logic as getInvestorPortfolio
export const getPortfolioOverview = async (req: Request, res: Response): Promise<void> => {
  try {
    const investorId = parseInt(req.query.investorId as string) || parseInt(req.body.investorId as string);
    
    if (!investorId || isNaN(investorId)) {
      res.status(400).json({ error: 'investorId is required and must be a valid number' });
      return;
    }

    // Use the same query as getInvestorPortfolio
    const transactions = await prisma.transaction.findMany({
      where: { investor_id: investorId },
      include: { 
        deal: {
          include: {
            deals_underlying_companies: {
              include: {
                company: true
              }
            },
            deal_company_investments: {
              include: {
                company: true
              }
            }
          }
        }
      },
    });

    const dealMetrics = [];

    for (const transaction of transactions) {
      const metrics = await calculateDealMetrics(transaction);
      dealMetrics.push(metrics);
    }

    const portfolioTotals = calculatePortfolioTotals(transactions, dealMetrics);

    res.json({
      currentValue: portfolioTotals.totalCurrentValue.toNumber(),
      totalReturnPercent: portfolioTotals.totalReturnPercent.toNumber(),
      moic: portfolioTotals.totalMoic.toNumber(),
      firstInvestmentDate: portfolioTotals.firstInvestmentDate,
      totalInvested: portfolioTotals.totalInvested.toNumber(),
      capitalEarned: portfolioTotals.totalCurrentValue.minus(portfolioTotals.totalInvested).toNumber(),
    });
  } catch (error) {
    console.error('Error fetching portfolio overview:', error);
    res.status(500).json({ error: 'Failed to fetch portfolio overview' });
  }
};

// Get company distribution
export const getCompanyDistribution = async (req: Request, res: Response): Promise<void> => {
  try {
    const investorId = parseInt(req.query.investorId as string) || parseInt(req.body.investorId as string);
    
    if (!investorId || isNaN(investorId)) {
      res.status(400).json({ error: 'investorId is required and must be a valid number' });
      return;
    }
    
    const distribution = await getCompanyDistributionHelper(investorId);
    res.json(distribution);
  } catch (error) {
    console.error('Error fetching company distribution:', error);
    res.status(500).json({ error: 'Failed to fetch company distribution' });
  }
};

// Get industry distribution
export const getIndustryDistribution = async (req: Request, res: Response): Promise<void> => {
  try {
    const investorId = parseInt(req.query.investorId as string) || parseInt(req.body.investorId as string);
    
    if (!investorId || isNaN(investorId)) {
      res.status(400).json({ error: 'investorId is required and must be a valid number' });
      return;
    }
    
    const distribution = await getIndustryDistributionHelper(investorId);
    res.json(distribution);
  } catch (error) {
    console.error('Error fetching industry distribution:', error);
    res.status(500).json({ error: 'Failed to fetch industry distribution' });
  }
};

// Get monthly returns
export const getMonthlyReturns = async (req: Request, res: Response): Promise<void> => {
  try {
    const investorId = parseInt(req.query.investorId as string) || parseInt(req.body.investorId as string);
    
    if (!investorId || isNaN(investorId)) {
      res.status(400).json({ error: 'investorId is required and must be a valid number' });
      return;
    }
    
    const returns = await getMonthlyReturnsHelper(investorId);
    res.json(returns);
  } catch (error) {
    console.error('Error fetching monthly returns:', error);
    res.status(500).json({ error: 'Failed to fetch monthly returns' });
  }
};

// Helper function to get company distribution
async function getCompanyDistributionHelper(investorId: number) {
  const investments = await prisma.transaction.findMany({
    where: { investor_id: investorId },
    include: {
      deal: {
        include: {
          deals_underlying_companies: {
            include: {
              company: true
            }
          },
          deal_company_investments: {
            include: {
              company: true,
            },
          },
        },
      },
    },
  });

  const companyMap = new Map<string, Decimal>();

  for (const investment of investments) {
    const netCapital = investment.initial_net_capital || new Decimal(0);
    const deal = investment.deal;
    
    // Use the same logic as getInvestorPortfolio
    const dealCompanyInvestments = deal.deal_company_investments;
    const isMultipleCompanies = dealCompanyInvestments.length > 1;

    if (isMultipleCompanies) {
      // Deal with multiple companies - use DealCompanyInvestment
      let totalDealInvestment = new Decimal(0);
      
      // Calculate total invested in the deal (sum of all investment_amount)
      dealCompanyInvestments.forEach(dci => {
        totalDealInvestment = totalDealInvestment.plus(dci.investment_amount);
      });

      for (const dci of dealCompanyInvestments) {
        const company = dci.company;
        const companyInvestmentAmount = dci.investment_amount;
        
        // Calculate this company's proportion in the total deal
        const companyProportion = totalDealInvestment.gt(0) 
          ? companyInvestmentAmount.div(totalDealInvestment) 
          : new Decimal(0);
        
        // Calculate how much of the investor's investment goes to this company
        const investorInvestmentInCompany = netCapital.mul(companyProportion);
        
        const companyName = company.company_name || 'Unknown';
        const current = companyMap.get(companyName) || new Decimal(0);
        companyMap.set(companyName, current.plus(investorInvestmentInCompany));
      }

    } else {
      // Deal with one company - check if it has deal_company_investments or underlying_company_id
      let company = null;
      
      // First check if there are deal_company_investments
      if (dealCompanyInvestments.length === 1) {
        const dci = dealCompanyInvestments[0];
        company = dci.company;
      } else if (deal.underlying_company_id) {
        // If no deal_company_investments, check underlying_company_id
        company = await prisma.company.findUnique({
          where: { id: deal.underlying_company_id }
        });
      } else {
        // If neither exists, check deals_underlying_companies
        const dealCompanies = deal.deals_underlying_companies;
        if (dealCompanies.length > 0) {
          company = dealCompanies[0].company;
        }
      }
      
      if (company) {
        const companyName = company.company_name || 'Unknown';
        const current = companyMap.get(companyName) || new Decimal(0);
        companyMap.set(companyName, current.plus(netCapital));
      }
    }
  }

  const totalInvested = Array.from(companyMap.values()).reduce((sum, amount) => 
    sum.plus(amount), new Decimal(0)
  );

  return Array.from(companyMap.entries()).map(([companyName, amount]) => ({
    companyName,
    amount: amount.toNumber(),
    percentage: totalInvested.gt(0) ? amount.div(totalInvested).mul(100).toNumber() : 0,
  }));
}

// Helper function to get industry distribution
async function getIndustryDistributionHelper(investorId: number) {
  const investments = await prisma.transaction.findMany({
    where: { investor_id: investorId },
    include: {
      deal: {
        include: {
          deals_underlying_companies: {
            include: {
              company: true
            }
          },
          deal_company_investments: {
            include: {
              company: true,
            },
          },
        },
      },
    },
  });

  const industryMap = new Map<string, Decimal>();

  for (const investment of investments) {
    const netCapital = investment.initial_net_capital || new Decimal(0);
    const deal = investment.deal;
    
    // Use the same logic as getInvestorPortfolio
    const dealCompanyInvestments = deal.deal_company_investments;
    const isMultipleCompanies = dealCompanyInvestments.length > 1;

    if (isMultipleCompanies) {
      // Deal with multiple companies - use DealCompanyInvestment
      let totalDealInvestment = new Decimal(0);
      
      // Calculate total invested in the deal (sum of all investment_amount)
      dealCompanyInvestments.forEach(dci => {
        totalDealInvestment = totalDealInvestment.plus(dci.investment_amount);
      });

      for (const dci of dealCompanyInvestments) {
        const company = dci.company;
        const companyInvestmentAmount = dci.investment_amount;
        
        // Calculate this company's proportion in the total deal
        const companyProportion = totalDealInvestment.gt(0) 
          ? companyInvestmentAmount.div(totalDealInvestment) 
          : new Decimal(0);
        
        // Calculate how much of the investor's investment goes to this company
        const investorInvestmentInCompany = netCapital.mul(companyProportion);
        
        const sector = company.company_sector || 'Unknown';
        const current = industryMap.get(sector) || new Decimal(0);
        industryMap.set(sector, current.plus(investorInvestmentInCompany));
      }

    } else {
      // Deal with one company - check if it has deal_company_investments or underlying_company_id
      let company = null;
      
      // First check if there are deal_company_investments
      if (dealCompanyInvestments.length === 1) {
        const dci = dealCompanyInvestments[0];
        company = dci.company;
      } else if (deal.underlying_company_id) {
        // If no deal_company_investments, check underlying_company_id
        company = await prisma.company.findUnique({
          where: { id: deal.underlying_company_id }
        });
      } else {
        // If neither exists, check deals_underlying_companies
        const dealCompanies = deal.deals_underlying_companies;
        if (dealCompanies.length > 0) {
          company = dealCompanies[0].company;
        }
      }
      
      if (company) {
        const sector = company.company_sector || 'Unknown';
        const current = industryMap.get(sector) || new Decimal(0);
        industryMap.set(sector, current.plus(netCapital));
      }
    }
  }

  const totalInvested = Array.from(industryMap.values()).reduce((sum, amount) => 
    sum.plus(amount), new Decimal(0)
  );

  return Array.from(industryMap.entries()).map(([industry, amount]) => ({
    industry,
    amount: amount.toNumber(),
    percentage: totalInvested.gt(0) ? amount.div(totalInvested).mul(100).toNumber() : 0,
  }));
}

// Helper function to get profit distribution by industry
async function getProfitDistributionHelper(investorId: number, latestValuations: any[]) {
  const investments = await prisma.transaction.findMany({
    where: { investor_id: investorId },
    include: {
      deal: {
        include: {
          deal_company_investments: {
            include: {
              company: true,
            },
          },
        },
      },
    },
  });

  const industryProfitMap = new Map<string, Decimal>();

  for (const inv of investments) {
    const netCapital = inv.initial_net_capital || new Decimal(0);
    const deal = inv.deal;
    const isMultipleCompanyDeal = deal.deal_company_investments.length > 1;

    if (isMultipleCompanyDeal) {
      // Calculate the proportion of this investor's investment
      const dealTotalNetCapital = deal.initial_net_capital || netCapital;
      const investorProportion = netCapital.div(dealTotalNetCapital);
      
      for (const dealCompanyInvestment of deal.deal_company_investments) {
        const company = dealCompanyInvestment.company;
        const sector = company.company_sector || 'Unknown';
        const investmentAmount = dealCompanyInvestment.investment_amount;
        const entryValuation = dealCompanyInvestment.entry_valuation;
        
        // Calculate the investor's proportional investment in this company
        const investorInvestmentInCompany = investmentAmount.mul(investorProportion);
        
        const latestValuation = latestValuations.find(v => v.company_id === company.id);
        
        if (latestValuation && entryValuation.gt(0)) {
          const moic = latestValuation.valuation_post_money.div(entryValuation);
          const currentValue = investorInvestmentInCompany.mul(moic);
          const profit = currentValue.minus(investorInvestmentInCompany);
          
          const current = industryProfitMap.get(sector) || new Decimal(0);
          industryProfitMap.set(sector, current.plus(profit));
        }
      }
    } else {
      // Deal with one company
      const dealCompanyInvestment = deal.deal_company_investments[0];
      if (dealCompanyInvestment) {
        const company = dealCompanyInvestment.company;
        const sector = company.company_sector || 'Unknown';
        const investmentAmount = dealCompanyInvestment.investment_amount;
        const entryValuation = deal.entry_valuation || new Decimal(0);
        
        const latestValuation = latestValuations.find(v => v.company_id === company.id);
        
        if (latestValuation && entryValuation.gt(0)) {
          const moic = latestValuation.valuation_post_money.div(entryValuation);
          const currentValue = investmentAmount.mul(moic);
          const profit = currentValue.minus(investmentAmount);
          
          const current = industryProfitMap.get(sector) || new Decimal(0);
          industryProfitMap.set(sector, current.plus(profit));
        }
      }
    }
  }

  const totalProfit = Array.from(industryProfitMap.values()).reduce((sum, profit) => 
    sum.plus(profit), new Decimal(0)
  );

  return Array.from(industryProfitMap.entries()).map(([industry, profit]) => ({
    industry,
    profit: profit.toNumber(),
    percentage: totalProfit.gt(0) ? profit.div(totalProfit).mul(100).toNumber() : 0,
  }));
}

// Helper function to get monthly returns
async function getMonthlyReturnsHelper(investorId: number) {
  const investments = await prisma.transaction.findMany({
    where: { investor_id: investorId },
    include: {
      deal: {
        include: {
          deals_underlying_companies: {
            include: {
              company: true
            }
          },
          deal_company_investments: {
            include: {
              company: true,
            },
          },
        },
      },
    },
    orderBy: {
      transaction_date: 'asc',
    },
  });

  // Group by month and calculate returns using the same logic as getInvestorPortfolio
  const monthlyMap = new Map<string, { invested: Decimal; currentValue: Decimal }>();

  for (const investment of investments) {
    const monthKey = investment.transaction_date.toISOString().substring(0, 7); // YYYY-MM
    const netCapital = investment.initial_net_capital || new Decimal(0);
    const deal = investment.deal;
    
    // Use the same logic as getInvestorPortfolio
    const dealCompanyInvestments = deal.deal_company_investments;
    const isMultipleCompanies = dealCompanyInvestments.length > 1;

    let dealCurrentValue = new Decimal(0);

    if (isMultipleCompanies) {
      // Deal with multiple companies - use DealCompanyInvestment
      let totalDealInvestment = new Decimal(0);
      
      // Calculate total invested in the deal (sum of all investment_amount)
      dealCompanyInvestments.forEach(dci => {
        totalDealInvestment = totalDealInvestment.plus(dci.investment_amount);
      });

      for (const dci of dealCompanyInvestments) {
        const company = dci.company;
        const companyInvestmentAmount = dci.investment_amount;
        const entryValuation = dci.entry_valuation;
        
        // Calculate this company's proportion in the total deal
        const companyProportion = totalDealInvestment.gt(0) 
          ? companyInvestmentAmount.div(totalDealInvestment) 
          : new Decimal(0);
        
        // Calculate how much of the investor's investment goes to this company
        const investorInvestmentInCompany = netCapital.mul(companyProportion);
        
        // Get the latest valuation for the company
        const latestValuation = await prisma.valuation.findFirst({
          where: { company_id: company.id },
          orderBy: { valuation_date: 'desc' },
        });

        let currentValue = investorInvestmentInCompany;

        if (latestValuation && entryValuation.gt(0)) {
          const moic = latestValuation.valuation_post_money.div(entryValuation);
          currentValue = investorInvestmentInCompany.mul(moic);
        }

        dealCurrentValue = dealCurrentValue.plus(currentValue);
      }

    } else {
      // Deal with one company - check if it has deal_company_investments or underlying_company_id
      let company = null;
      let entryValuation = new Decimal(0);
      
      // First check if there are deal_company_investments
      if (dealCompanyInvestments.length === 1) {
        const dci = dealCompanyInvestments[0];
        company = dci.company;
        entryValuation = dci.entry_valuation;
      } else if (deal.underlying_company_id) {
        // If no deal_company_investments, check underlying_company_id
        company = await prisma.company.findUnique({
          where: { id: deal.underlying_company_id }
        });
        entryValuation = deal.entry_valuation || new Decimal(0);
      } else {
        // If neither exists, check deals_underlying_companies
        const dealCompanies = deal.deals_underlying_companies;
        if (dealCompanies.length > 0) {
          company = dealCompanies[0].company;
          entryValuation = deal.entry_valuation || new Decimal(0);
        }
      }
      
      if (company) {
        // Get the latest valuation for the company
        const latestValuation = await prisma.valuation.findFirst({
          where: { company_id: company.id },
          orderBy: { valuation_date: 'desc' },
        });

        let currentValue = netCapital;

        if (latestValuation && entryValuation.gt(0)) {
          const moic = latestValuation.valuation_post_money.div(entryValuation);
          currentValue = netCapital.mul(moic);
        }

        dealCurrentValue = currentValue;
      } else {
        // Even without company, we should count the investment
        dealCurrentValue = netCapital; // Assume it maintains value if no valuation
      }
    }

    // Add to monthly totals
    const current = monthlyMap.get(monthKey) || { 
      invested: new Decimal(0), 
      currentValue: new Decimal(0) 
    };
    
    current.invested = current.invested.plus(netCapital);
    current.currentValue = current.currentValue.plus(dealCurrentValue);
    
    monthlyMap.set(monthKey, current);
  }

  return Array.from(monthlyMap.entries()).map(([month, data]) => ({
    month,
    invested: data.invested.toNumber(),
    currentValue: data.currentValue.toNumber(),
    returnPercent: data.invested.gt(0) 
      ? data.currentValue.minus(data.invested).div(data.invested).mul(100).toNumber() 
      : 0,
  }));
} 