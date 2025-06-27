import express from 'express';
import * as dotenv from 'dotenv';
import publicRoutes from './routes/public.routes';
import investorRoutes from './routes/investor.routes';
import adminRoutes from './routes/admin.routes';
import authRoutes from './routes/auth.routes';

dotenv.config();

const app = express();
app.use(express.json());

// Routes
app.use(publicRoutes);
app.use(investorRoutes);
app.use(adminRoutes);
app.use(authRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
