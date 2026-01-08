import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database';

export interface AuthRequest extends Request {
  user?: any;
  apiKey?: any;
}

export const authenticateJWT = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      res.status(401).json({ error: 'No authentication token provided' });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });

    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid authentication token' });
  }
};

export const authenticateApiKey = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const apiKey = req.header('X-API-Key') || req.body.apiKey;

    if (!apiKey) {
      res.status(401).json({ error: 'No API key provided' });
      return;
    }

    const key = await prisma.apiKey.findUnique({
      where: { key: apiKey },
      include: { user: true }
    });

    if (!key || !key.isActive) {
      res.status(401).json({ error: 'Invalid API key' });
      return;
    }

    // Update last used timestamp
    await prisma.apiKey.update({
      where: { id: key.id },
      data: { lastUsed: new Date() }
    });

    req.apiKey = key;
    req.user = key.user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'API key authentication failed' });
  }
};
