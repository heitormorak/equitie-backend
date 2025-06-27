const { PrismaClient } = require('@prisma/client');
const { Decimal } = require('@prisma/client/runtime/library');

const prisma = new PrismaClient();

async function testPortfolioLogic() {
  try {
    const investorId = 2;

    console.log('=== TESTE DA LÓGICA DO PORTFOLIO ===\n');

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

    console.log(`Encontradas ${transactions.length} transações para o investidor ${investorId}\n`);

    let totalInvested = new Decimal(0);
    let totalCurrentValue = new Decimal(0);

    for (const transaction of transactions) {
      const deal = transaction.deal;
      const investorInvestment = transaction.initial_net_capital || new Decimal(0);
      
      console.log(`=== DEAL ${deal.id}: ${deal.deal_name} ===`);
      console.log(`Investidor investiu: $${investorInvestment.toNumber()}`);
      
      // 2. Verificar quantas empresas estão associadas a este deal
      // Primeiro verificar se há registros em deal_company_investments
      const dealCompanyInvestments = deal.deal_company_investments;
      const isMultipleCompanies = dealCompanyInvestments.length > 1;

      console.log(`Número de empresas no deal (deal_company_investments): ${dealCompanyInvestments.length}`);
      console.log(`É deal com múltiplas empresas: ${isMultipleCompanies}`);

      let dealCurrentValue = new Decimal(0);

      if (isMultipleCompanies) {
        console.log(`\n--- DEAL COM MÚLTIPLAS EMPRESAS ---`);
        
        let totalDealInvestment = new Decimal(0);
        
        // Calcular o total investido no deal
        dealCompanyInvestments.forEach(dci => {
          totalDealInvestment = totalDealInvestment.plus(dci.investment_amount);
        });
        
        console.log(`Total investido no deal: $${totalDealInvestment.toNumber()}`);
        
        // Calcular a proporção do investidor no deal
        const investorProportion = totalDealInvestment.gt(0) 
          ? investorInvestment.div(totalDealInvestment) 
          : new Decimal(0);
        
        console.log(`Proporção do investidor no deal: ${(investorProportion.toNumber() * 100).toFixed(2)}%`);

        for (const dci of dealCompanyInvestments) {
          const company = dci.company;
          const companyInvestmentAmount = dci.investment_amount;
          const entryValuation = dci.entry_valuation;
          
          // Calcular quanto o investidor investiu nesta empresa específica
          const investorInvestmentInCompany = companyInvestmentAmount.mul(investorProportion);
          
          // Buscar o valuation mais recente da empresa
          const latestValuation = await prisma.valuation.findFirst({
            where: { company_id: company.id },
            orderBy: { valuation_date: 'desc' },
          });

          let moic = new Decimal(1);
          let currentValue = investorInvestmentInCompany;

          if (latestValuation && entryValuation.gt(0)) {
            moic = latestValuation.valuation_post_money.div(entryValuation);
            currentValue = investorInvestmentInCompany.mul(moic);
          }

          console.log(`\n  Empresa: ${company.company_name}`);
          console.log(`  Investment Amount no deal: $${companyInvestmentAmount.toNumber()}`);
          console.log(`  Entry Valuation: $${entryValuation.toNumber()}`);
          console.log(`  Latest Valuation: $${latestValuation?.valuation_post_money.toNumber() || 'N/A'}`);
          console.log(`  Investor Investment in Company: $${investorInvestmentInCompany.toNumber()}`);
          console.log(`  MOIC: ${moic.toNumber()}`);
          console.log(`  Current Value: $${currentValue.toNumber()}`);

          dealCurrentValue = dealCurrentValue.plus(currentValue);
        }

      } else {
        console.log(`\n--- DEAL COM UMA EMPRESA ---`);
        
        let company = null;
        let entryValuation = new Decimal(0);
        
        // Primeiro verificar se há deal_company_investments
        if (dealCompanyInvestments.length === 1) {
          const dci = dealCompanyInvestments[0];
          company = dci.company;
          entryValuation = dci.entry_valuation;
          console.log(`  Usando empresa de deal_company_investments: ${company.company_name}`);
        } else if (deal.underlying_company_id) {
          // Se não há deal_company_investments, verificar underlying_company_id
          company = await prisma.company.findUnique({
            where: { id: deal.underlying_company_id }
          });
          entryValuation = deal.entry_valuation || new Decimal(0);
          console.log(`  Usando empresa de underlying_company_id: ${company?.company_name}`);
        } else {
          // Se não há nenhum dos dois, verificar deals_underlying_companies
          const dealCompanies = deal.deals_underlying_companies;
          if (dealCompanies.length > 0) {
            company = dealCompanies[0].company;
            entryValuation = deal.entry_valuation || new Decimal(0);
            console.log(`  Usando empresa de deals_underlying_companies: ${company.company_name}`);
          }
        }
        
        if (company) {
          // Buscar o valuation mais recente da empresa
          const latestValuation = await prisma.valuation.findFirst({
            where: { company_id: company.id },
            orderBy: { valuation_date: 'desc' },
          });

          let moic = new Decimal(1);
          let currentValue = investorInvestment;

          if (latestValuation && entryValuation.gt(0)) {
            moic = latestValuation.valuation_post_money.div(entryValuation);
            currentValue = investorInvestment.mul(moic);
          }

          console.log(`\n  Empresa: ${company.company_name}`);
          console.log(`  Entry Valuation: $${entryValuation.toNumber()}`);
          console.log(`  Latest Valuation: $${latestValuation?.valuation_post_money.toNumber() || 'N/A'}`);
          console.log(`  Investor Investment: $${investorInvestment.toNumber()}`);
          console.log(`  MOIC: ${moic.toNumber()}`);
          console.log(`  Current Value: $${currentValue.toNumber()}`);

          dealCurrentValue = currentValue;
        } else {
          console.log(`  Nenhuma empresa encontrada para o deal ${deal.id}`);
        }
      }

      const dealMoic = investorInvestment.gt(0) ? dealCurrentValue.div(investorInvestment) : new Decimal(1);

      console.log(`\n  RESUMO DEAL ${deal.id}:`);
      console.log(`  Investido: $${investorInvestment.toNumber()}`);
      console.log(`  Valor Atual: $${dealCurrentValue.toNumber()}`);
      console.log(`  MOIC: ${dealMoic.toNumber()}`);
      console.log(`  ---`);

      totalInvested = totalInvested.plus(investorInvestment);
      totalCurrentValue = totalCurrentValue.plus(dealCurrentValue);
    }

    const totalMoic = totalInvested.gt(0) ? totalCurrentValue.div(totalInvested) : new Decimal(0);
    const totalReturnPercent = totalInvested.gt(0)
      ? totalCurrentValue.minus(totalInvested).div(totalInvested).mul(100)
      : new Decimal(0);

    console.log(`\n=== RESUMO FINAL ===`);
    console.log(`Total Investido: $${totalInvested.toNumber()}`);
    console.log(`Valor Atual Total: $${totalCurrentValue.toNumber()}`);
    console.log(`MOIC Total: ${totalMoic.toNumber()}`);
    console.log(`Retorno %: ${totalReturnPercent.toNumber()}%`);
    console.log(`Capital Ganho: $${totalCurrentValue.minus(totalInvested).toNumber()}`);

  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPortfolioLogic(); 