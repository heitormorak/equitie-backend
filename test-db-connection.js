const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testConnection() {
  try {
    console.log('Testando conexão com o banco de dados...');
    
    // Testar conexão básica
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('Conexão bem-sucedida!', result);
    
    // Verificar se há dados do investidor 2
    const investor = await prisma.investor.findUnique({
      where: { id: 2 }
    });
    
    if (investor) {
      console.log('Investidor encontrado:', investor.full_name);
      
      // Verificar transações do investidor
      const transactions = await prisma.transaction.findMany({
        where: { investor_id: 2 },
        include: { deal: true }
      });
      
      console.log(`Encontradas ${transactions.length} transações para o investidor 2`);
      
      transactions.forEach((t, i) => {
        console.log(`${i + 1}. Deal ${t.deal_id}: ${t.deal.deal_name} - $${t.initial_net_capital?.toNumber() || 0}`);
      });
      
    } else {
      console.log('Investidor 2 não encontrado');
    }
    
  } catch (error) {
    console.error('Erro na conexão:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection(); 