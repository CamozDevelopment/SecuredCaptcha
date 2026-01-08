import UAParser from 'ua-parser-js';
import geoip from 'geoip-lite';
import crypto from 'crypto';

export interface FingerprintData {
  fingerprint: string;
  userAgent: string;
  ipAddress: string;
  acceptLanguage?: string;
  acceptEncoding?: string;
  screenResolution?: string;
  timezone?: number;
  canvas?: string;
  webgl?: string;
  fonts?: string[];
}

export interface BotAnalysis {
  score: number;
  signals: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  reasons: string[];
}

export class BotDetector {
  
  // Analyze user agent for bot signatures
  static analyzeUserAgent(userAgent: string): { isBot: boolean; confidence: number; type?: string } {
    const parser = new UAParser(userAgent);
    const result = parser.getResult();
    
    // Known bot patterns
    const botPatterns = [
      /bot/i, /crawl/i, /spider/i, /scrape/i, /curl/i, /wget/i,
      /python/i, /java/i, /php/i, /ruby/i, /go-http/i,
      /headless/i, /phantom/i, /selenium/i, /puppeteer/i
    ];
    
    let isBot = false;
    let confidence = 0;
    let type = '';
    
    for (const pattern of botPatterns) {
      if (pattern.test(userAgent)) {
        isBot = true;
        confidence = 0.9;
        type = 'Known bot signature';
        break;
      }
    }
    
    // Check for missing or suspicious UA components
    if (!result.browser.name || !result.os.name) {
      confidence = Math.max(confidence, 0.7);
      isBot = true;
      type = 'Incomplete user agent';
    }
    
    // Check for very old browsers (likely bots)
    if (result.browser.version && parseFloat(result.browser.version) < 50) {
      confidence = Math.max(confidence, 0.6);
    }
    
    return { isBot, confidence, type };
  }
  
  // Generate fingerprint from multiple signals
  static generateFingerprint(data: Partial<FingerprintData>): string {
    const components = [
      data.userAgent || '',
      data.acceptLanguage || '',
      data.acceptEncoding || '',
      data.screenResolution || '',
      data.timezone?.toString() || '',
      data.canvas || '',
      data.webgl || '',
      data.fonts?.join(',') || ''
    ];
    
    const fingerprint = crypto
      .createHash('sha256')
      .update(components.join('|'))
      .digest('hex');
    
    return fingerprint;
  }
  
  // Analyze timing patterns
  static analyzeTimingPatterns(requestTimings: number[]): { suspicious: boolean; reason: string } {
    if (requestTimings.length < 3) {
      return { suspicious: false, reason: 'Insufficient data' };
    }
    
    // Check for perfectly uniform timing (bot behavior)
    const intervals: number[] = [];
    for (let i = 1; i < requestTimings.length; i++) {
      intervals.push(requestTimings[i] - requestTimings[i - 1]);
    }
    
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((sum, interval) => {
      return sum + Math.pow(interval - avgInterval, 2);
    }, 0) / intervals.length;
    
    const stdDev = Math.sqrt(variance);
    
    // Low variance indicates automated behavior
    if (stdDev < 10 && intervals.length > 5) {
      return { suspicious: true, reason: 'Uniform timing pattern detected' };
    }
    
    // Very fast requests
    if (avgInterval < 100) {
      return { suspicious: true, reason: 'Requests too fast for human' };
    }
    
    return { suspicious: false, reason: 'Normal timing pattern' };
  }
  
  // Comprehensive bot detection analysis
  static async analyzeBotBehavior(data: {
    userAgent: string;
    fingerprint: string;
    ipAddress: string;
    mouseMovements?: Array<{ x: number; y: number; timestamp: number }>;
    keystrokes?: Array<{ key: string; timestamp: number }>;
    requestTimings?: number[];
    previousChallenges?: number;
  }): Promise<BotAnalysis> {
    
    let score = 0;
    const signals: string[] = [];
    const reasons: string[] = [];
    
    // 1. User Agent Analysis (0-25 points)
    const uaAnalysis = this.analyzeUserAgent(data.userAgent);
    if (uaAnalysis.isBot) {
      score += 25 * uaAnalysis.confidence;
      signals.push('suspicious_ua');
      reasons.push(`User agent: ${uaAnalysis.type}`);
    }
    
    // 2. Mouse Movement Analysis (0-20 points)
    if (data.mouseMovements) {
      if (data.mouseMovements.length === 0) {
        score += 20;
        signals.push('no_mouse_movement');
        reasons.push('No mouse movement detected');
      } else if (data.mouseMovements.length < 5) {
        score += 15;
        signals.push('minimal_mouse_movement');
        reasons.push('Minimal mouse activity');
      } else {
        // Analyze if movements are too perfect (straight lines)
        const movements = data.mouseMovements;
        let straightLines = 0;
        for (let i = 2; i < movements.length; i++) {
          const dx1 = movements[i - 1].x - movements[i - 2].x;
          const dy1 = movements[i - 1].y - movements[i - 2].y;
          const dx2 = movements[i].x - movements[i - 1].x;
          const dy2 = movements[i].y - movements[i - 1].y;
          
          // Check if points are collinear
          if (Math.abs(dx1 * dy2 - dy1 * dx2) < 1) {
            straightLines++;
          }
        }
        
        if (straightLines > movements.length * 0.7) {
          score += 10;
          signals.push('linear_mouse_movement');
          reasons.push('Mouse movements too linear');
        }
      }
    }
    
    // 3. Keystroke Analysis (0-15 points)
    if (data.keystrokes) {
      if (data.keystrokes.length === 0) {
        score += 10;
        signals.push('no_keystrokes');
      } else {
        // Check for uniform timing
        const intervals: number[] = [];
        for (let i = 1; i < data.keystrokes.length; i++) {
          intervals.push(data.keystrokes[i].timestamp - data.keystrokes[i - 1].timestamp);
        }
        
        if (intervals.length > 0) {
          const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
          const variance = intervals.reduce((sum, interval) => {
            return sum + Math.pow(interval - avgInterval, 2);
          }, 0) / intervals.length;
          
          if (variance < 100) {
            score += 15;
            signals.push('uniform_keystrokes');
            reasons.push('Keystroke timing too uniform');
          }
        }
      }
    }
    
    // 4. Request Timing Analysis (0-15 points)
    if (data.requestTimings && data.requestTimings.length > 2) {
      const timingAnalysis = this.analyzeTimingPatterns(data.requestTimings);
      if (timingAnalysis.suspicious) {
        score += 15;
        signals.push('suspicious_timing');
        reasons.push(timingAnalysis.reason);
      }
    }
    
    // 5. Challenge History (0-15 points)
    if (data.previousChallenges !== undefined) {
      if (data.previousChallenges > 10) {
        score += 15;
        signals.push('excessive_challenges');
        reasons.push('Too many challenge attempts');
      } else if (data.previousChallenges > 5) {
        score += 8;
        signals.push('high_challenge_count');
      }
    }
    
    // 6. IP Reputation (0-10 points) - Basic check
    const geo = geoip.lookup(data.ipAddress);
    if (!geo) {
      score += 5;
      signals.push('unknown_geolocation');
      reasons.push('IP geolocation unavailable');
    }
    
    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' | 'critical';
    if (score >= 75) {
      riskLevel = 'critical';
    } else if (score >= 50) {
      riskLevel = 'high';
    } else if (score >= 25) {
      riskLevel = 'medium';
    } else {
      riskLevel = 'low';
    }
    
    return {
      score: Math.min(100, Math.round(score)),
      signals,
      riskLevel,
      reasons
    };
  }
  
  // Check if fingerprint is suspicious
  static async checkFingerprintReputation(
    fingerprint: string,
    ipAddress: string
  ): Promise<{ suspicious: boolean; reason?: string }> {
    // In a real implementation, check against a database of known bad fingerprints
    // For now, basic validation
    
    // Check if fingerprint is too simple (likely spoofed)
    if (fingerprint.length < 32) {
      return { suspicious: true, reason: 'Fingerprint too simple' };
    }
    
    return { suspicious: false };
  }
}
