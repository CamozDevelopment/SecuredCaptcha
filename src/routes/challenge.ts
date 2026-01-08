import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { prisma } from '../config/database';
import { authenticateApiKey, AuthRequest } from '../middleware/auth';
import { challengeRateLimiter, tierRateLimiter } from '../middleware/rateLimiter';
import { BotDetector } from '../services/botDetection';
import { IPIntelligence } from '../services/ipIntelligence';
import { AbuseDetector } from '../services/abuseDetection';
import { body, validationResult } from 'express-validator';

const router = Router();

// Create a new challenge
router.post(
  '/create',
  challengeRateLimiter,
  [
    body('siteKey').notEmpty(),
    body('action').optional().isString(),
  ],
  async (req: AuthRequest, res: Response) => {
    const startTime = Date.now();
    
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { siteKey, action = 'verify' } = req.body;
      
      // Verify site key
      const apiKey = await prisma.apiKey.findUnique({
        where: { siteKey },
        include: { user: true }
      });
      
      if (!apiKey || !apiKey.isActive) {
        return res.status(401).json({ error: 'Invalid site key' });
      }

      // Get request metadata
      const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 
                       req.socket.remoteAddress || 
                       'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';
      const fingerprint = req.body.fingerprint || BotDetector.generateFingerprint({
        userAgent,
        ipAddress,
        acceptLanguage: req.headers['accept-language'],
        acceptEncoding: req.headers['accept-encoding']
      });

      // Check for abuse
      const abuseCheck = await AbuseDetector.detectAbusePatterns(
        ipAddress,
        fingerprint,
        siteKey
      );

      if (abuseCheck.blocked) {
        return res.status(403).json({
          error: 'Request blocked',
          reason: abuseCheck.reason,
          severity: abuseCheck.severity
        });
      }

      // Run bot detection
      const botAnalysis = await BotDetector.analyzeBotBehavior({
        userAgent,
        fingerprint,
        ipAddress,
        mouseMovements: req.body.mouseMovements,
        keystrokes: req.body.keystrokes,
        requestTimings: req.body.requestTimings
      });

      // Run IP intelligence
      const ipAnalysis = await IPIntelligence.analyzeIP(ipAddress);

      // Calculate overall score (0-100, lower is better)
      const overallScore = Math.round((botAnalysis.score * 0.6 + ipAnalysis.abuseScore * 0.4));
      
      // Determine if additional challenge is needed
      const requiresChallenge = overallScore > 30 || abuseCheck.shouldChallenge;

      // Generate challenge
      const challengeId = uuidv4();
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 
        parseInt(process.env.CHALLENGE_EXPIRY_SECONDS || '300') * 1000
      );

      // Create challenge record
      const challenge = await prisma.challenge.create({
        data: {
          challengeId,
          siteKey,
          token,
          action,
          verified: false,
          score: 100 - overallScore,
          riskLevel: botAnalysis.riskLevel.toUpperCase() as any,
          ipAddress,
          userAgent,
          fingerprint,
          botScore: botAnalysis.score,
          vpnDetected: ipAnalysis.vpnDetected,
          proxyDetected: ipAnalysis.proxyDetected,
          torDetected: ipAnalysis.torDetected,
          abuseScore: ipAnalysis.abuseScore,
          geoCountry: ipAnalysis.country,
          geoCity: '',
          geoRegion: '',
          expiresAt
        }
      });

      // Log usage
      await prisma.usage.create({
        data: {
          userId: apiKey.userId,
          apiKeyId: apiKey.id,
          endpoint: '/challenge/create',
          method: 'POST',
          statusCode: 200,
          responseTime: Date.now() - startTime,
          ipAddress
        }
      });

      // Return challenge response
      res.json({
        success: true,
        challengeId,
        token,
        requiresInteraction: requiresChallenge,
        expiresAt,
        metadata: {
          score: 100 - overallScore,
          riskLevel: botAnalysis.riskLevel
        }
      });
    } catch (error) {
      console.error('Challenge creation error:', error);
      res.status(500).json({ error: 'Failed to create challenge' });
    }
  }
);

// Verify challenge
router.post(
  '/verify',
  [
    body('token').notEmpty(),
    body('response').optional(),
    body('fingerprint').optional(),
  ],
  async (req: AuthRequest, res: Response) => {
    const startTime = Date.now();
    
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { token, response, fingerprint } = req.body;

      // Find challenge
      const challenge = await prisma.challenge.findUnique({ where: { token } });

      if (!challenge) {
        return res.status(404).json({
          success: false,
          error: 'Challenge not found or expired'
        });
      }

      // Check if already verified
      if (challenge.verified) {
        return res.status(400).json({
          success: false,
          error: 'Challenge already verified'
        });
      }

      // Check expiration
      if (challenge.expiresAt < new Date()) {
        return res.status(400).json({
          success: false,
          error: 'Challenge expired'
        });
      }

      // Verify fingerprint consistency
      let updatedScore = challenge.score;
      let updatedRiskLevel = challenge.riskLevel;
      
      if (fingerprint && fingerprint !== challenge.fingerprint) {
        updatedScore = Math.max(0, challenge.score - 20);
        updatedRiskLevel = 'HIGH';
      }

      // Get API key for usage tracking
      const apiKey = await prisma.apiKey.findUnique({
        where: { siteKey: challenge.siteKey },
        include: { user: true }
      });
      
      if (!apiKey) {
        return res.status(401).json({
          success: false,
          error: 'Invalid API configuration'
        });
      }

      // Mark as verified
      const verifiedChallenge = await prisma.challenge.update({
        where: { id: challenge.id },
        data: {
          verified: true,
          score: updatedScore,
          riskLevel: updatedRiskLevel
        }
      });

      // Get IP address for usage tracking
      const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 
                        req.socket.remoteAddress || 
                        'unknown';

      // Log usage
      await prisma.usage.create({
        data: {
          userId: apiKey.userId,
          apiKeyId: apiKey.id,
          endpoint: '/challenge/verify',
          method: 'POST',
          statusCode: 200,
          responseTime: Date.now() - startTime,
          ipAddress
        }
      });

      // Return verification result
      res.json({
        success: true,
        score: verifiedChallenge.score,
        riskLevel: verifiedChallenge.riskLevel,
        metadata: {
          botScore: verifiedChallenge.botScore,
          vpnDetected: verifiedChallenge.vpnDetected,
          proxyDetected: verifiedChallenge.proxyDetected,
          torDetected: verifiedChallenge.torDetected,
          abuseScore: challenge.abuseScore
        }
      });
    } catch (error) {
      console.error('Challenge verification error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to verify challenge'
      });
    }
  }
);

// Get challenge status (for polling)
router.get(
  '/status/:challengeId',
  async (req: AuthRequest, res) => {
    try {
      const { challengeId } = req.params;

      const challenge = await prisma.challenge.findUnique({ where: { challengeId } });

      if (!challenge) {
        return res.status(404).json({
          error: 'Challenge not found'
        });
      }

      res.json({
        challengeId: challenge.challengeId,
        verified: challenge.verified,
        expired: challenge.expiresAt < new Date(),
        score: challenge.score,
        riskLevel: challenge.riskLevel
      });
    } catch (error) {
      console.error('Challenge status error:', error);
      res.status(500).json({ error: 'Failed to get challenge status' });
    }
  }
);

export default router;
