import { Router } from 'express';
import { loginWithGoogle } from '../controllers/auth.controller';

const router = Router();

router.post('/auth/google', loginWithGoogle); // Receives Google ID token → returns JWT + user info

export default router;
