import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import * as jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

// Google login endpoint
export const loginWithGoogle = async (req: Request, res: Response): Promise<void> => {
  try {
    const { googleIdToken, email, fullName, profilePicture } = req.body;

    // Validate required fields
    if (!googleIdToken || !email) {
      res.status(400).json({ 
        error: 'Google ID token and email are required' 
      });
      return;
    }

    // In a real implementation, you would verify the Google ID token here
    // For now, we'll trust the provided data
    // TODO: Implement Google ID token verification
    
    // Find or create investor
    let investor = await prisma.investor.findFirst({
      where: { primary_email: email },
    });

    if (!investor) {
      // Create new investor
      investor = await prisma.investor.create({
        data: {
          full_name: fullName || 'Unknown',
          primary_email: email,
          investor_type: 'INDIVIDUAL',
          nationality: 'Unknown',
          country_of_residence: 'Unknown',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: investor.id,
        email: investor.primary_email,
        role: 'INVESTOR', // Default role for Google login
      },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '24h' }
    );

    // Return user info and token
    res.json({
      message: 'Login successful',
      token,
      user: {
        id: investor.id,
        email: investor.primary_email,
        fullName: investor.full_name,
        role: 'INVESTOR',
        investorType: investor.investor_type,
        isApproved: investor.id_checked,
      },
    });
  } catch (error) {
    console.error('Error during Google login:', error);
    res.status(500).json({ error: 'Login failed' });
  }
}; 