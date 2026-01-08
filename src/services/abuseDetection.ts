import { redisClient, prisma } from '../config/database';

export interface AbuseDetectionResult {
  blocked: boolean;
  reason?: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  shouldChallenge: boolean;
}

export class AbuseDetector {
  
  // Check for rate limit abuse
  static async checkRateLimit(
    identifier: string,
    windowSeconds: number = 60,
    maxRequests: number = 30
  ): Promise<{ limited: boolean; current: number; remaining: number }> {
    const key = `ratelimit:${identifier}:${Math.floor(Date.now() / 1000 / windowSeconds)}`;
    
    try {
      const current = await redisClient.incr(key);
      await redisClient.expire(key, windowSeconds);
      
      const limited = current > maxRequests;
      const remaining = Math.max(0, maxRequests - current);
      
      return { limited, current, remaining };
    } catch (error) {
      console.warn('Rate limit check failed:', error);
      return { limited: false, current: 0, remaining: maxRequests };
    }
  }
  
  // Detect abuse patterns
  static async detectAbusePatterns(
    ipAddress: string,
    fingerprint: string,
    siteKey?: string
  ): Promise<AbuseDetectionResult> {
    
    // 1. Check if already blacklisted
    const isBlacklisted = await this.isBlacklisted(ipAddress, fingerprint);
    if (isBlacklisted) {
      return {
        blocked: true,
        reason: 'IP or fingerprint is blacklisted',
        severity: 'CRITICAL',
        shouldChallenge: false
      };
    }
    
    // 2. Check rate limiting
    const ipRateLimit = await this.checkRateLimit(`ip:${ipAddress}`, 60, 30);
    if (ipRateLimit.limited) {
      await this.logAbuse({
        ipAddress,
        fingerprint,
        siteKey,
        reason: 'Rate limit exceeded',
        severity: 'MEDIUM',
        metadata: { requestCount: ipRateLimit.current }
      });
      
      // Temporary block after multiple rate limit violations
      const violations = await this.getViolationCount(ipAddress, 300);
      if (violations > 5) {
        await this.tempBlockIP(ipAddress, 3600); // Block for 1 hour
        return {
          blocked: true,
          reason: 'Multiple rate limit violations',
          severity: 'HIGH',
          shouldChallenge: false
        };
      }
      
      return {
        blocked: false,
        reason: 'Rate limit exceeded',
        severity: 'MEDIUM',
        shouldChallenge: true
      };
    }
    
    // 3. Check fingerprint rate limiting
    const fpRateLimit = await this.checkRateLimit(`fp:${fingerprint}`, 60, 20);
    if (fpRateLimit.limited) {
      await this.logAbuse({
        ipAddress,
        fingerprint,
        siteKey,
        reason: 'Fingerprint rate limit exceeded',
        severity: 'MEDIUM',
        metadata: { requestCount: fpRateLimit.current }
      });
      
      return {
        blocked: false,
        reason: 'Too many requests from same fingerprint',
        severity: 'MEDIUM',
        shouldChallenge: true
      };
    }
    
    // 4. Check for distributed attack patterns
    const distributedAttack = await this.detectDistributedAttack(siteKey || 'global');
    if (distributedAttack.detected) {
      return {
        blocked: false,
        reason: 'Distributed attack detected',
        severity: 'HIGH',
        shouldChallenge: true
      };
    }
    
    // 5. Check recent abuse logs for this IP
    const recentAbuse = await this.getRecentAbuseCount(ipAddress, 3600);
    if (recentAbuse > 10) {
      await this.tempBlockIP(ipAddress, 7200); // Block for 2 hours
      return {
        blocked: true,
        reason: 'Repeated abuse detected',
        severity: 'CRITICAL',
        shouldChallenge: false
      };
    }
    
    return {
      blocked: false,
      severity: 'LOW',
      shouldChallenge: false
    };
  }
  
  // Check if IP or fingerprint is blacklisted
  private static async isBlacklisted(ipAddress: string, fingerprint: string): Promise<boolean> {
    try {
      // Check Redis cache first
      const ipBlocked = await redisClient.exists(`blacklist:ip:${ipAddress}`);
      const fpBlocked = await redisClient.exists(`blacklist:fp:${fingerprint}`);
      
      if (ipBlocked === 1 || fpBlocked === 1) {
        return true;
      }
      
      // Check database
      const blacklisted = await prisma.blacklist.findFirst({
        where: {
          AND: [
            {
              OR: [
                { type: 'IP', value: ipAddress },
                { type: 'FINGERPRINT', value: fingerprint }
              ]
            },
            {
              OR: [
                { permanent: true },
                { expiresAt: { gt: new Date() } }
              ]
            }
          ]
        }
      });
      
      return !!blacklisted;
    } catch (error) {
      console.error('Blacklist check error:', error);
      return false;
    }
  }
  
  // Log abuse incident
  private static async logAbuse(data: {
    ipAddress: string;
    fingerprint?: string;
    siteKey?: string;
    reason: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    metadata?: any;
  }): Promise<void> {
    try {
      await prisma.abuseLog.create({
        data: {
          ipAddress: data.ipAddress,
          fingerprint: data.fingerprint,
          siteKey: data.siteKey,
          reason: data.reason,
          severity: data.severity,
          metadata: data.metadata || {}
        }
      });
    } catch (error) {
      console.error('Failed to log abuse:', error);
    }
  }
  
  // Get violation count in time window
  private static async getViolationCount(ipAddress: string, windowSeconds: number): Promise<number> {
    try {
      const since = new Date(Date.now() - windowSeconds * 1000);
      const count = await prisma.abuseLog.count({
        where: {
          ipAddress: ipAddress,
          createdAt: { gte: since }
        }
      });
      return count;
    } catch (error) {
      return 0;
    }
  }
  
  // Get recent abuse count
  private static async getRecentAbuseCount(ipAddress: string, windowSeconds: number): Promise<number> {
    try {
      const since = new Date(Date.now() - windowSeconds * 1000);
      const count = await prisma.abuseLog.count({
        where: {
          ipAddress: ipAddress,
          createdAt: { gte: since },
          severity: { in: ['HIGH', 'CRITICAL'] }
        }
      });
      return count;
    } catch (error) {
      return 0;
    }
  }
  
  // Temporarily block IP
  private static async tempBlockIP(ipAddress: string, durationSeconds: number): Promise<void> {
    try {
      await redisClient.setEx(`blacklist:ip:${ipAddress}`, durationSeconds, '1');
      
      const expiresAt = new Date(Date.now() + durationSeconds * 1000);
      
      await prisma.blacklist.upsert({
        where: {
          type_value: {
            type: 'IP',
            value: ipAddress
          }
        },
        update: {
          reason: 'Temporary block due to abuse',
          expiresAt,
          permanent: false
        },
        create: {
          type: 'IP',
          value: ipAddress,
          reason: 'Temporary block due to abuse',
          expiresAt,
          permanent: false
        }
      });
    } catch (error) {
      console.error('Failed to block IP:', error);
    }
  }
  
  // Detect distributed attack patterns
  private static async detectDistributedAttack(siteKey: string): Promise<{
    detected: boolean;
    requestRate?: number;
  }> {
    try {
      const key = `attack:${siteKey}`;
      const current = await redisClient.incr(key);
      
      // Set expiry on first request
      if (current === 1) {
        await redisClient.expire(key, 10); // 10 second window
      }
      
      // If more than 100 requests in 10 seconds, it's likely an attack
      const detected = current > 100;
      return { detected, requestRate: current };
    } catch (error) {
      return { detected: false };
    }
  }
  
  // Add to permanent blacklist
  static async addToBlacklist(
    type: 'IP' | 'FINGERPRINT' | 'EMAIL',
    value: string,
    reason: string
  ): Promise<void> {
    try {
      await prisma.blacklist.upsert({
        where: {
          type_value: {
            type,
            value
          }
        },
        update: {
          reason,
          permanent: true
        },
        create: {
          type,
          value,
          reason,
          permanent: true
        }
      });
      
      // Also add to Redis
      await redisClient.set(`blacklist:${type.toLowerCase()}:${value}`, '1');
    } catch (error) {
      console.error('Failed to add to blacklist:', error);
    }
  }
}
