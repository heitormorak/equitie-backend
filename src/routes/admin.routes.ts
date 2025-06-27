import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/roles';
import {
  listInvestors,
  approveInvestor,
  listDeals,
  updateValuations,
} from '../controllers/admin.controller';

const router = Router();

// Apply authentication and authorization to all admin routes
router.get('/admin/investors', authenticate, authorize(['ADMIN']), listInvestors);
router.post('/admin/investors/:id/approve', authenticate, authorize(['ADMIN']), approveInvestor);

router.get('/admin/deals', authenticate, authorize(['ADMIN']), listDeals);
router.put('/admin/valuations/:companyId', authenticate, authorize(['ADMIN']), updateValuations);

export default router;
