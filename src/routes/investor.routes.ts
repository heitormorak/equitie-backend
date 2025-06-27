import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/roles';
import {
  getInvestorPortfolio,
  getInvestmentDetails,
  getCompanyDistribution,
  getIndustryDistribution,
  getMonthlyReturns,
  getPortfolioOverview,
} from '../controllers/investor.controller';

const router = Router();

// Apply authentication and authorization to all investor routes
// router.get('/investor/portfolio', authenticate, authorize(['INVESTOR']), getInvestorPortfolio);
// router.get('/investor/investments/:dealId', authenticate, authorize(['INVESTOR']), getInvestmentDetails);

// Temporary routes without authentication for testing
router.get('/investor/portfolio', getInvestorPortfolio);
router.get('/investor/investments/:dealId', getInvestmentDetails);

// Specific routes for each case
router.get('/investor/portfolio/overview', getPortfolioOverview); // Portfolio summary
router.get('/investor/portfolio/companies', getCompanyDistribution); // Company asset distribution
router.get('/investor/portfolio/industries', getIndustryDistribution); // Industry distribution
router.get('/investor/portfolio/monthly-returns', getMonthlyReturns); // Monthly returns

export default router;
