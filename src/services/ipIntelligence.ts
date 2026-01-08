import axios from 'axios';
import geoip from 'geoip-lite';
import { redisClient } from '../config/database';

export interface IPAnalysis {
  vpnDetected: boolean;
  proxyDetected: boolean;
  torDetected: boolean;
  abuseScore: number;
  country?: string;
  isp?: string;
  asn?: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  reasons: string[];
}

export class IPIntelligence {
  
  // Check IP against multiple sources
  static async analyzeIP(ipAddress: string): Promise<IPAnalysis> {
    const cacheKey = `ip:analysis:${ipAddress}`;
    
    // Check cache first
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      console.warn('Redis cache unavailable');
    }
    
    let vpnDetected = false;
    let proxyDetected = false;
    let torDetected = false;
    let abuseScore = 0;
    const reasons: string[] = [];
    
    // 1. GeoIP basic check
    const geo = geoip.lookup(ipAddress);
    const country = geo?.country;
    
    // 2. Check against known VPN/Proxy ranges
    const vpnCheck = await this.checkVPNDatabase(ipAddress);
    if (vpnCheck.isVPN) {
      vpnDetected = true;
      abuseScore += 30;
      reasons.push('IP matches VPN provider');
    }
    
    if (vpnCheck.isProxy) {
      proxyDetected = true;
      abuseScore += 25;
      reasons.push('IP matches proxy service');
    }
    
    if (vpnCheck.isTor) {
      torDetected = true;
      abuseScore += 40;
      reasons.push('IP is Tor exit node');
    }
    
    // 3. Check hosting provider
    const hostingCheck = await this.checkHostingProvider(ipAddress);
    if (hostingCheck.isHosting) {
      abuseScore += 20;
      reasons.push(`Hosting provider detected: ${hostingCheck.provider}`);
    }
    
    // 4. Check IP reputation (if API keys available)
    try {
      const reputationCheck = await this.checkIPReputation(ipAddress);
      abuseScore += reputationCheck.score;
      if (reputationCheck.reasons.length > 0) {
        reasons.push(...reputationCheck.reasons);
      }
    } catch (error) {
      console.warn('IP reputation check failed:', error);
    }
    
    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' | 'critical';
    if (abuseScore >= 75) {
      riskLevel = 'critical';
    } else if (abuseScore >= 50) {
      riskLevel = 'high';
    } else if (abuseScore >= 25) {
      riskLevel = 'medium';
    } else {
      riskLevel = 'low';
    }
    
    const analysis: IPAnalysis = {
      vpnDetected,
      proxyDetected,
      torDetected,
      abuseScore: Math.min(100, abuseScore),
      country,
      riskLevel,
      reasons
    };
    
    // Cache result for 1 hour
    try {
      await redisClient.setEx(cacheKey, 3600, JSON.stringify(analysis));
    } catch (error) {
      console.warn('Failed to cache IP analysis');
    }
    
    return analysis;
  }
  
  // Check against VPN/Proxy database
  private static async checkVPNDatabase(ipAddress: string): Promise<{
    isVPN: boolean;
    isProxy: boolean;
    isTor: boolean;
  }> {
    // Known VPN/Proxy IP ranges (simplified example)
    // In production, use a comprehensive database or API service
    
    const knownVPNRanges = [
      '10.0.0.0/8',
      '172.16.0.0/12',
      '192.168.0.0/16'
    ];
    
    // Check Tor exit nodes (example)
    const isTor = await this.checkTorExitNode(ipAddress);
    
    // For production, integrate with services like:
    // - IPQualityScore
    // - IPHub
    // - ProxyCheck.io
    // - IP2Proxy
    
    return {
      isVPN: false, // Implement actual VPN detection
      isProxy: false, // Implement actual proxy detection
      isTor
    };
  }
  
  // Check if IP is a Tor exit node
  private static async checkTorExitNode(ipAddress: string): Promise<boolean> {
    try {
      // Tor Project maintains a list of exit nodes
      // Example: check against public Tor exit node list
      // https://check.torproject.org/exit-addresses
      
      // For demo purposes, returning false
      // In production, implement actual Tor check
      return false;
    } catch (error) {
      return false;
    }
  }
  
  // Check if IP belongs to hosting provider
  private static async checkHostingProvider(ipAddress: string): Promise<{
    isHosting: boolean;
    provider?: string;
  }> {
    // Known hosting provider ASN ranges
    const hostingProviders = [
      { name: 'AWS', asns: [16509, 14618] },
      { name: 'Google Cloud', asns: [15169] },
      { name: 'Microsoft Azure', asns: [8075] },
      { name: 'DigitalOcean', asns: [14061] },
      { name: 'Hetzner', asns: [24940] },
      { name: 'OVH', asns: [16276] }
    ];
    
    // In production, lookup ASN for the IP and check against hosting providers
    // For now, returning false
    return { isHosting: false };
  }
  
  // Check IP reputation using external services
  private static async checkIPReputation(ipAddress: string): Promise<{
    score: number;
    reasons: string[];
  }> {
    const reasons: string[] = [];
    let score = 0;
    
    // IPQualityScore API (if API key available)
    if (process.env.IPQUALITYSCORE_API_KEY) {
      try {
        const response = await axios.get(
          `https://ipqualityscore.com/api/json/ip/${process.env.IPQUALITYSCORE_API_KEY}/${ipAddress}`,
          { timeout: 5000 }
        );
        
        if (response.data.success) {
          if (response.data.proxy) {
            score += 25;
            reasons.push('Proxy detected by IPQS');
          }
          if (response.data.vpn) {
            score += 25;
            reasons.push('VPN detected by IPQS');
          }
          if (response.data.tor) {
            score += 30;
            reasons.push('Tor detected by IPQS');
          }
          if (response.data.fraud_score > 75) {
            score += 20;
            reasons.push(`High fraud score: ${response.data.fraud_score}`);
          }
        }
      } catch (error) {
        console.warn('IPQS API call failed');
      }
    }
    
    // IPInfo API (if token available)
    if (process.env.IPINFO_TOKEN) {
      try {
        const response = await axios.get(
          `https://ipinfo.io/${ipAddress}?token=${process.env.IPINFO_TOKEN}`,
          { timeout: 5000 }
        );
        
        if (response.data.privacy) {
          if (response.data.privacy.vpn) {
            score += 25;
            reasons.push('VPN detected by IPInfo');
          }
          if (response.data.privacy.proxy) {
            score += 25;
            reasons.push('Proxy detected by IPInfo');
          }
          if (response.data.privacy.hosting) {
            score += 15;
            reasons.push('Hosting provider detected by IPInfo');
          }
        }
      } catch (error) {
        console.warn('IPInfo API call failed');
      }
    }
    
    return { score, reasons };
  }
  
  // Check if IP is in our local blacklist
  static async isBlacklisted(ipAddress: string): Promise<boolean> {
    try {
      const exists = await redisClient.exists(`blacklist:ip:${ipAddress}`);
      return exists === 1;
    } catch (error) {
      return false;
    }
  }
  
  // Add IP to blacklist
  static async blacklistIP(ipAddress: string, duration: number = 86400): Promise<void> {
    try {
      await redisClient.setEx(`blacklist:ip:${ipAddress}`, duration, '1');
    } catch (error) {
      console.error('Failed to blacklist IP:', error);
    }
  }
}
