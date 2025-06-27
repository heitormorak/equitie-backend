import { Router } from 'express';
import { getLandingStats, submitInvestorInterest } from '../controllers/public.controller';

const router = Router();

router.get('/public/stats', getLandingStats); // snapshots for the landing page
router.post('/public/interested', submitInvestorInterest); // Form from visitor

export default router;
