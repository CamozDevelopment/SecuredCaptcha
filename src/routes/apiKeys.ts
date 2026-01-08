import { Router, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../config/database';
import { authenticateJWT, AuthRequest } from '../middleware/auth';
import { body, validationResult } from 'express-validator';

const router = Router();

// Create API key
router.post(
  '/create',
  authenticateJWT,
  [
    body('name').trim().notEmpty(),
    body('domains').optional().isArray(),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, domains } = req.body;

      // Generate keys
      const key = `sk_${crypto.randomBytes(32).toString('hex')}`;
      const siteKey = `pk_${crypto.randomBytes(16).toString('hex')}`;
      const secretKey = `secret_${crypto.randomBytes(32).toString('hex')}`;

      const apiKey = await prisma.apiKey.create({
        data: {
          userId: req.user!.id,
          key,
          name,
          siteKey,
          secretKey,
          domains: domains || [],
          isActive: true
        }
      });

      res.status(201).json({
        message: 'API key created successfully',
        apiKey: {
          id: apiKey.id,
          name: apiKey.name,
          key: apiKey.key,
          siteKey: apiKey.siteKey,
          secretKey: apiKey.secretKey,
          domains: apiKey.domains,
          createdAt: apiKey.createdAt
        }
      });
    } catch (error) {
      console.error('API key creation error:', error);
      res.status(500).json({ error: 'Failed to create API key' });
    }
  }
);

// List API keys
router.get('/list', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const apiKeys = await prisma.apiKey.findMany({
      where: { userId: req.user!.id },
      select: {
        id: true,
        name: true,
        key: true,
        siteKey: true,
        domains: true,
        isActive: true,
        lastUsed: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ apiKeys });
  } catch (error) {
    console.error('API key list error:', error);
    res.status(500).json({ error: 'Failed to list API keys' });
  }
});

// Get API key details
router.get('/:keyId', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const apiKey = await prisma.apiKey.findFirst({
      where: {
        id: req.params.keyId,
        userId: req.user!.id
      }
    });

    if (!apiKey) {
      return res.status(404).json({ error: 'API key not found' });
    }

    res.json({ apiKey });
  } catch (error) {
    console.error('API key fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch API key' });
  }
});

// Update API key
router.patch(
  '/:keyId',
  authenticateJWT,
  async (req: AuthRequest, res: Response) => {
    try {
      const { name, domains, isActive } = req.body;
      
      const apiKey = await prisma.apiKey.findFirst({
        where: {
          id: req.params.keyId,
          userId: req.user!.id
        }
      });

      if (!apiKey) {
        return res.status(404).json({ error: 'API key not found' });
      }

      const updatedKey = await prisma.apiKey.update({
        where: { id: apiKey.id },
        data: {
          ...(name && { name }),
          ...(domains && { domains }),
          ...(typeof isActive === 'boolean' && { isActive })
        }
      });
      
      res.json({
        message: 'API key updated successfully',
        apiKey: updatedKey
      });
    } catch (error) {
      console.error('API key update error:', error);
      res.status(500).json({ error: 'Failed to update API key' });
    }
  }
);

// Delete API key
router.delete('/:keyId',
  authenticateJWT,
  async (req: AuthRequest, res: Response) => {
    try {
      const apiKey = await prisma.apiKey.deleteMany({
        where: {
          id: req.params.keyId,
          userId: req.user!.id
        }
      });

      if (apiKey.count === 0) {
        return res.status(404).json({ error: 'API key not found' });
      }

      res.json({ message: 'API key deleted successfully' });
    } catch (error) {
      console.error('API key deletion error:', error);
      res.status(500).json({ error: 'Failed to delete API key' });
    }
  }
);

export default router;
