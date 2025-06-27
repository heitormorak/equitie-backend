import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

// Get investor portfolio overview
export const getInvestorPortfolio = async (req: Request, res: Response): Promise<void> => {
  try {
    const investorId = 2; // Substituir pelo req.user.id quando autenticado

    // 1. Identificar todos os deals que o investidor investiu
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

    let totalInvested = new Decimal(0);
    let totalCurrentValue = new Decimal(0);
    let firstInvestmentDate: Date | null = null;
    const investmentsWithMetrics = [];

    for (const transaction of transactions) {
      const deal = transaction.deal;
      const investorInvestment = transaction.initial_net_capital || new Decimal(0);
      
      console.log(`=== PROCESSANDO DEAL ${deal.id}: ${deal.deal_name} ===`);
      console.log(`Investidor investiu: $${investorInvestment.toNumber()}`);
      
      // 2. Verificar quantas empresas estão associadas a este deal
      const dealCompanyInvestments = deal.deal_company_investments;
      const isMultipleCompanies = dealCompanyInvestments.length > 1;

      console.log(`Número de empresas no deal (deal_company_investments): ${dealCompanyInvestments.length}`);
      console.log(`É deal com múltiplas empresas: ${isMultipleCompanies}`);

      let dealCurrentValue = new Decimal(0);
      let dealInvested = investorInvestment;
      const companySummaries = [];

      if (isMultipleCompanies) {
        // 3. Deal com múltiplas empresas - usar DealCompanyInvestment
        console.log(`=== DEAL COM MÚLTIPLAS EMPRESAS ===`);
        
        // Para deals com múltiplas empresas, o investimento do investidor deve ser
        // distribuído proporcionalmente entre as empresas baseado no investment_amount
        let totalDealInvestment = new Decimal(0);
        
        // Calcular o total investido no deal (soma de todos os investment_amount)
        dealCompanyInvestments.forEach(dci => {
          totalDealInvestment = totalDealInvestment.plus(dci.investment_amount);
        });
        
        console.log(`Total investido no deal: $${totalDealInvestment.toNumber()}`);

        for (const dci of dealCompanyInvestments) {
          const company = dci.company;
          const companyInvestmentAmount = dci.investment_amount;
          const entryValuation = dci.entry_valuation;
          
          // Calcular a proporção desta empresa no deal total
          const companyProportion = totalDealInvestment.gt(0) 
            ? companyInvestmentAmount.div(totalDealInvestment) 
            : new Decimal(0);
          
          // Calcular quanto do investimento do investidor vai para esta empresa
          const investorInvestmentInCompany = investorInvestment.mul(companyProportion);
          
          // Buscar o valuation mais recente da empresa
          const latestValuation = await prisma.valuation.findFirst({
            where: { company_id: company.id },
            orderBy: { valuation_date: 'desc' },
          });

          console.log(`=== BUSCANDO VALUATION PARA ${company.company_name} (ID: ${company.id}) ===`);
          console.log(`Latest valuation encontrado:`, latestValuation ? 'SIM' : 'NÃO');
          if (latestValuation) {
            console.log(`Valuation amount: ${latestValuation.valuation_post_money.toNumber()}`);
            console.log(`Valuation date: ${latestValuation.valuation_date}`);
          }

          let moic = new Decimal(1);
          let currentValue = investorInvestmentInCompany;

          if (latestValuation && entryValuation.gt(0)) {
            moic = latestValuation.valuation_post_money.div(entryValuation);
            currentValue = investorInvestmentInCompany.mul(moic);
          } else if (latestValuation && entryValuation.eq(0)) {
            // Se entry_valuation é 0 mas existe latest valuation, usar o investment como base
            console.log(`Entry valuation é 0, mantendo valor investido para ${company.company_name}`);
          }

          console.log(`=== EMPRESA ${company.company_name} ===`);
          console.log(`Investment Amount no deal: ${companyInvestmentAmount.toNumber()}`);
          console.log(`Proporção da empresa: ${(companyProportion.toNumber() * 100).toFixed(2)}%`);
          console.log(`Entry Valuation: ${entryValuation.toNumber()}`);
          console.log(`Latest Valuation: ${latestValuation?.valuation_post_money.toNumber() || 'N/A'}`);
          console.log(`Investor Investment in Company: ${investorInvestmentInCompany.toNumber()}`);
          console.log(`MOIC: ${moic.toNumber()}`);
          console.log(`Current Value: ${currentValue.toNumber()}`);

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
        // 4. Deal com uma empresa - verificar se tem deal_company_investments ou underlying_company_id
        console.log(`=== DEAL COM UMA EMPRESA ===`);
        
        let company = null;
        let entryValuation = new Decimal(0);
        
        // Primeiro verificar se há deal_company_investments
        if (dealCompanyInvestments.length === 1) {
          const dci = dealCompanyInvestments[0];
          company = dci.company;
          entryValuation = dci.entry_valuation;
          console.log(`Usando empresa de deal_company_investments: ${company.company_name}`);
        } else if (deal.underlying_company_id) {
          // Se não há deal_company_investments, verificar underlying_company_id
          company = await prisma.company.findUnique({
            where: { id: deal.underlying_company_id }
          });
          entryValuation = deal.entry_valuation || new Decimal(0);
          console.log(`Usando empresa de underlying_company_id: ${company?.company_name}`);
        } else {
          // Se não há nenhum dos dois, verificar deals_underlying_companies
          const dealCompanies = deal.deals_underlying_companies;
          if (dealCompanies.length > 0) {
            company = dealCompanies[0].company;
            entryValuation = deal.entry_valuation || new Decimal(0);
            console.log(`Usando empresa de deals_underlying_companies: ${company.company_name}`);
          }
        }
        
        if (company) {
          // Buscar o valuation mais recente da empresa
          const latestValuation = await prisma.valuation.findFirst({
            where: { company_id: company.id },
            orderBy: { valuation_date: 'desc' },
          });

          console.log(`=== BUSCANDO VALUATION PARA ${company.company_name} (ID: ${company.id}) ===`);
          console.log(`Latest valuation encontrado:`, latestValuation ? 'SIM' : 'NÃO');
          if (latestValuation) {
            console.log(`Valuation amount: ${latestValuation.valuation_post_money.toNumber()}`);
            console.log(`Valuation date: ${latestValuation.valuation_date}`);
          }

          let moic = new Decimal(1);
          let currentValue = investorInvestment;

          if (latestValuation && entryValuation.gt(0)) {
            moic = latestValuation.valuation_post_money.div(entryValuation);
            currentValue = investorInvestment.mul(moic);
          } else if (latestValuation && entryValuation.eq(0)) {
            // Se entry_valuation é 0 mas existe latest valuation, usar o investment como base
            console.log(`Entry valuation é 0, mantendo valor investido para ${company.company_name}`);
          }

          console.log(`=== EMPRESA ${company.company_name} ===`);
          console.log(`Entry Valuation: ${entryValuation.toNumber()}`);
          console.log(`Latest Valuation: ${latestValuation?.valuation_post_money.toNumber() || 'N/A'}`);
          console.log(`Investor Investment: ${investorInvestment.toNumber()}`);
          console.log(`MOIC: ${moic.toNumber()}`);
          console.log(`Current Value: ${currentValue.toNumber()}`);

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
          console.log(`Nenhuma empresa encontrada para o deal ${deal.id}`);
          // Mesmo sem empresa, devemos contabilizar o investimento
          dealCurrentValue = investorInvestment; // Assume que mantém o valor se não há valuation
        }
      }

      const dealMoic = dealInvested.gt(0) ? dealCurrentValue.div(dealInvested) : new Decimal(1);

      investmentsWithMetrics.push({
        dealId: deal.id,
        dealName: deal.deal_name,
        companyNames: companySummaries.map(c => c.companyName).join(', '),
        currentValue: dealCurrentValue.toNumber(),
        investedAmount: dealInvested.toNumber(),
        dealDate: deal.deal_date,
        moic: dealMoic.toNumber(),
        dealType: deal.deal_type,
        dealStatus: deal.deal_status,
        isMultipleCompanyDeal: isMultipleCompanies,
        companies: companySummaries,
      });

      // IMPORTANTE: Somar TODOS os valores ao total
      totalInvested = totalInvested.plus(dealInvested);
      totalCurrentValue = totalCurrentValue.plus(dealCurrentValue);

      if (!firstInvestmentDate || transaction.transaction_date < firstInvestmentDate) {
        firstInvestmentDate = transaction.transaction_date;
      }

      console.log(`=== RESUMO DEAL ${deal.id} ===`);
      console.log(`Investido: $${dealInvested.toNumber()}`);
      console.log(`Valor Atual: $${dealCurrentValue.toNumber()}`);
      console.log(`MOIC: ${dealMoic.toNumber()}`);
      console.log(`Total Investido Acumulado: $${totalInvested.toNumber()}`);
      console.log(`Total Valor Atual Acumulado: $${totalCurrentValue.toNumber()}`);
      console.log(`---`);
    }

    const totalMoic = totalInvested.gt(0) ? totalCurrentValue.div(totalInvested) : new Decimal(0);
    const totalReturnPercent = totalInvested.gt(0)
      ? totalCurrentValue.minus(totalInvested).div(totalInvested).mul(100)
      : new Decimal(0);

    console.log(`=== RESUMO FINAL ===`);
    console.log(`Total de deals processados: ${transactions.length}`);
    console.log(`Total Investido: $${totalInvested.toNumber()}`);
    console.log(`Valor Atual Total: $${totalCurrentValue.toNumber()}`);
    console.log(`MOIC Total: ${totalMoic.toNumber()}`);
    console.log(`Retorno %: ${totalReturnPercent.toNumber()}`);

    res.json({
      portfolio: {
        currentValue: totalCurrentValue.toNumber(),
        totalReturnPercent: totalReturnPercent.toNumber(),
        moic: totalMoic.toNumber(),
        firstInvestmentDate,
        totalInvested: totalInvested.toNumber(),
        capitalEarned: totalCurrentValue.minus(totalInvested).toNumber(),
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
    // const investorId = req.user?.id;
    
    // if (!investorId) {
    //   res.status(401).json({ error: 'User not authenticated' });
    //   return;
    // }

    // Temporary: Use a hardcoded investor ID for testing
    const investorId = 2;
    
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

// Get portfolio overview (summary)
export const getPortfolioOverview = async (req: Request, res: Response): Promise<void> => {
  try {
    // Temporary: Use a hardcoded investor ID for testing
    const investorId = 2;

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

    // Get all company IDs
    const allCompanyIds = new Set<number>();
    investments.forEach(inv => {
      inv.deal.deal_company_investments.forEach(dci => {
        allCompanyIds.add(dci.company_id);
      });
    });

    const latestValuations = await prisma.valuation.findMany({
      where: {
        company_id: { in: Array.from(allCompanyIds) },
      },
      orderBy: {
        valuation_date: 'desc',
      },
      distinct: ['company_id'],
    });

    let totalInvested = new Decimal(0);
    let totalCurrentValue = new Decimal(0);
    let firstInvestmentDate: Date | null = null;

    for (const investment of investments) {
      const netCapital = investment.initial_net_capital || new Decimal(0);
      const deal = investment.deal;
      
      // Determine if this is a single or multiple company deal
      const isMultipleCompanyDeal = deal.deal_company_investments.length > 1;

      if (isMultipleCompanyDeal) {
        // LÓGICA PARA DEALS COM MÚLTIPLAS EMPRESAS (como o Deal ID 11)
        console.log(`=== PROCESSANDO DEAL ${deal.deal_id} COM MÚLTIPLAS EMPRESAS ===`);
        
        // Calcular a proporção do investimento deste investidor
        const dealTotalNetCapital = deal.initial_net_capital || netCapital;
        const investorProportion = netCapital.div(dealTotalNetCapital);
        
        let totalInvestedInDeal = new Decimal(0);
        let totalCurrentValueInDeal = new Decimal(0);
        
        deal.deal_company_investments.forEach(dealCompanyInvestment => {
          const companyName = dealCompanyInvestment.company.company_name || 'Unknown Company';
          const investmentAmount = dealCompanyInvestment.investment_amount;
          const entryValuation = dealCompanyInvestment.entry_valuation;
          
          // Calcular o investimento proporcional do investidor nesta empresa
          const investorInvestmentInCompany = investmentAmount.mul(investorProportion);
          
          // Buscar valuation mais recente da empresa
          const latestValuation = latestValuations.find(v => v.company_id === dealCompanyInvestment.company_id);
          
          let moic = new Decimal(1);
          let currentValueInCompany = investorInvestmentInCompany;
          
          if (latestValuation && entryValuation.gt(0)) {
            moic = latestValuation.valuation_post_money.div(entryValuation);
            currentValueInCompany = investorInvestmentInCompany.mul(moic);
          }
          
          console.log(`=== EMPRESA ${companyName} ===`);
          console.log(`Investment Amount: ${investmentAmount.toNumber()}`);
          console.log(`Entry Valuation: ${entryValuation.toNumber()}`);
          console.log(`Latest Valuation: ${latestValuation?.valuation_post_money.toNumber() || 'N/A'}`);
          console.log(`Investor Proportion: ${investorProportion.toNumber()}`);
          console.log(`Investor Investment in Company: ${investorInvestmentInCompany.toNumber()}`);
          console.log(`MOIC: ${moic.toNumber()}`);
          console.log(`Current Value in Company: ${currentValueInCompany.toNumber()}`);
          
          totalInvestedInDeal = totalInvestedInDeal.plus(investorInvestmentInCompany);
          totalCurrentValueInDeal = totalCurrentValueInDeal.plus(currentValueInCompany);
        });
        
        console.log(`=== TOTAL DEAL ${deal.deal_id} ===`);
        console.log(`Total Invested: ${totalInvestedInDeal.toNumber()}`);
        console.log(`Total Current Value: ${totalCurrentValueInDeal.toNumber()}`);
        
        totalInvested = totalInvested.plus(totalInvestedInDeal);
        totalCurrentValue = totalCurrentValue.plus(totalCurrentValueInDeal);
        
      } else {
        // LÓGICA PARA DEALS COM UMA EMPRESA
        const dealCompanyInvestment = deal.deal_company_investments[0];
        if (dealCompanyInvestment) {
          const companyInvestmentAmount = dealCompanyInvestment.investment_amount;
          const entryValuation = deal.entry_valuation || new Decimal(0);
          
          const latestValuation = latestValuations.find(v => v.company_id === dealCompanyInvestment.company_id);
          
          if (latestValuation && entryValuation.gt(0)) {
            const moic = latestValuation.valuation_post_money.div(entryValuation);
            const currentValue = companyInvestmentAmount.mul(moic);
            totalCurrentValue = totalCurrentValue.plus(currentValue);
          }
        }
        
        totalInvested = totalInvested.plus(netCapital);
      }

      if (!firstInvestmentDate || investment.transaction_date < firstInvestmentDate) {
        firstInvestmentDate = investment.transaction_date;
      }
    }

    const totalMoic = totalInvested.gt(0) ? totalCurrentValue.div(totalInvested) : new Decimal(0);
    const totalReturnPercent = totalInvested.gt(0) 
      ? totalCurrentValue.minus(totalInvested).div(totalInvested).mul(100) 
      : new Decimal(0);

    res.json({
      currentValue: totalCurrentValue.toNumber(),
      totalReturnPercent: totalReturnPercent.toNumber(),
      moic: totalMoic.toNumber(),
      firstInvestmentDate,
      totalInvested: totalInvested.toNumber(),
      capitalEarned: totalCurrentValue.minus(totalInvested).toNumber(),
    });
  } catch (error) {
    console.error('Error fetching portfolio overview:', error);
    res.status(500).json({ error: 'Failed to fetch portfolio overview' });
  }
};

// Get company distribution
export const getCompanyDistribution = async (req: Request, res: Response): Promise<void> => {
  try {
    const investorId = 2;
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
    const investorId = 2;
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
    const investorId = 1;
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

  investments.forEach(inv => {
    const netCapital = inv.initial_net_capital || new Decimal(0);
    const deal = inv.deal;
    const isMultipleCompanyDeal = deal.deal_company_investments.length > 1;

    if (isMultipleCompanyDeal) {
      // Calcular a proporção do investimento deste investidor
      const dealTotalNetCapital = deal.initial_net_capital || netCapital;
      const investorProportion = netCapital.div(dealTotalNetCapital);
      
      deal.deal_company_investments.forEach(dci => {
        const companyName = dci.company.company_name || 'Unknown';
        const investmentAmount = dci.investment_amount;
        const investorInvestmentInCompany = investmentAmount.mul(investorProportion);
        
        const current = companyMap.get(companyName) || new Decimal(0);
        companyMap.set(companyName, current.plus(investorInvestmentInCompany));
      });
    } else {
      // Deal com uma empresa
      const dci = deal.deal_company_investments[0];
      if (dci) {
        const companyName = dci.company.company_name || 'Unknown';
        const investmentAmount = dci.investment_amount;
        
        const current = companyMap.get(companyName) || new Decimal(0);
        companyMap.set(companyName, current.plus(investmentAmount));
      }
    }
  });

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

  investments.forEach(inv => {
    const netCapital = inv.initial_net_capital || new Decimal(0);
    const deal = inv.deal;
    const isMultipleCompanyDeal = deal.deal_company_investments.length > 1;

    if (isMultipleCompanyDeal) {
      // Calcular a proporção do investimento deste investidor
      const dealTotalNetCapital = deal.initial_net_capital || netCapital;
      const investorProportion = netCapital.div(dealTotalNetCapital);
      
      deal.deal_company_investments.forEach(dci => {
        const sector = dci.company.company_sector || 'Unknown';
        const investmentAmount = dci.investment_amount;
        const investorInvestmentInCompany = investmentAmount.mul(investorProportion);
        
        const current = industryMap.get(sector) || new Decimal(0);
        industryMap.set(sector, current.plus(investorInvestmentInCompany));
      });
    } else {
      // Deal com uma empresa
      const dci = deal.deal_company_investments[0];
      if (dci) {
        const sector = dci.company.company_sector || 'Unknown';
        const investmentAmount = dci.investment_amount;
        
        const current = industryMap.get(sector) || new Decimal(0);
        industryMap.set(sector, current.plus(investmentAmount));
      }
    }
  });

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
      // Calcular a proporção do investimento deste investidor
      const dealTotalNetCapital = deal.initial_net_capital || netCapital;
      const investorProportion = netCapital.div(dealTotalNetCapital);
      
      for (const dealCompanyInvestment of deal.deal_company_investments) {
        const company = dealCompanyInvestment.company;
        const sector = company.company_sector || 'Unknown';
        const investmentAmount = dealCompanyInvestment.investment_amount;
        const entryValuation = dealCompanyInvestment.entry_valuation;
        
        // Calcular o investimento proporcional do investidor nesta empresa
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
      // Deal com uma empresa
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

  // Group by month and calculate returns
  const monthlyMap = new Map<string, { invested: Decimal; currentValue: Decimal }>();

  for (const inv of investments) {
    const monthKey = inv.transaction_date.toISOString().substring(0, 7); // YYYY-MM
    const netCapital = inv.initial_net_capital || new Decimal(0);
    
    // For simplicity, we'll use a basic return calculation
    // In a real implementation, you'd want to track actual monthly valuations
    const estimatedReturn = netCapital.mul(1.1); // 10% estimated return
    
    const current = monthlyMap.get(monthKey) || { 
      invested: new Decimal(0), 
      currentValue: new Decimal(0) 
    };
    
    current.invested = current.invested.plus(netCapital);
    current.currentValue = current.currentValue.plus(estimatedReturn);
    
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