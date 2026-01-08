const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-in-production-' + crypto.randomBytes(32).toString('hex');

// Initialize SQLite database
const db = new Database('captcha.db');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS challenges (
    id TEXT PRIMARY KEY,
    fingerprint TEXT NOT NULL,
    siteKey TEXT NOT NULL,
    riskScore REAL NOT NULL,
    verified INTEGER DEFAULT 0,
    createdAt INTEGER NOT NULL,
    expiresAt INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS rate_limits (
    ip TEXT PRIMARY KEY,
    count INTEGER DEFAULT 1,
    firstRequest INTEGER NOT NULL,
    lastRequest INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS abuse_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip TEXT NOT NULL,
    fingerprint TEXT NOT NULL,
    reason TEXT NOT NULL,
    timestamp INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_challenges_expires ON challenges(expiresAt);
  CREATE INDEX IF NOT EXISTS idx_rate_limits_ip ON rate_limits(ip);
`);

// Middleware
app.use(express.json());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  credentials: true
}));

// Serve widget and demo
app.use(express.static('public'));

// Clean expired challenges every 5 minutes
setInterval(() => {
  const now = Date.now();
  db.prepare('DELETE FROM challenges WHERE expiresAt < ?').run(now);
  db.prepare('DELETE FROM rate_limits WHERE lastRequest < ?').run(now - 3600000); // 1 hour
}, 300000);

// Rate limiting helper
function checkRateLimit(ip) {
  const now = Date.now();
  const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000;
  const maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100;

  const record = db.prepare('SELECT * FROM rate_limits WHERE ip = ?').get(ip);

  if (!record) {
    db.prepare('INSERT INTO rate_limits (ip, count, firstRequest, lastRequest) VALUES (?, 1, ?, ?)').run(ip, now, now);
    return true;
  }

  if (now - record.firstRequest > windowMs) {
    db.prepare('UPDATE rate_limits SET count = 1, firstRequest = ?, lastRequest = ? WHERE ip = ?').run(now, now, ip);
    return true;
  }

  if (record.count >= maxRequests) {
    return false;
  }

  db.prepare('UPDATE rate_limits SET count = count + 1, lastRequest = ? WHERE ip = ?').run(now, ip);
  return true;
}

// Calculate risk score
function calculateRiskScore(data) {
  let score = 0;
  
  // Check fingerprint quality
  if (!data.fingerprint || data.fingerprint.length < 10) {
    score += 0.3;
  }

  // Check mouse movements
  if (!data.mouseMovements || data.mouseMovements.length < 5) {
    score += 0.2;
  }

  // Check timing patterns
  if (data.requestTimings && data.requestTimings.length > 1) {
    const intervals = [];
    for (let i = 1; i < data.requestTimings.length; i++) {
      intervals.push(data.requestTimings[i] - data.requestTimings[i - 1]);
    }
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    
    // Too fast or too uniform = suspicious
    if (avgInterval < 50 || intervals.every(i => Math.abs(i - avgInterval) < 10)) {
      score += 0.25;
    }
  }

  // Random variation
  score += Math.random() * 0.1;

  return Math.min(score, 1);
}

// Log abuse
function logAbuse(ip, fingerprint, reason) {
  db.prepare('INSERT INTO abuse_logs (ip, fingerprint, reason, timestamp) VALUES (?, ?, ?, ?)').run(
    ip,
    fingerprint,
    reason,
    Date.now()
  );
}

// Routes

// Create challenge
app.post('/api/challenge/create', (req, res) => {
  try {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

    // Rate limiting
    if (!checkRateLimit(ip)) {
      logAbuse(ip, req.body.fingerprint, 'Rate limit exceeded');
      return res.status(429).json({ error: 'Too many requests' });
    }

    const { siteKey, fingerprint, mouseMovements, keystrokes, requestTimings } = req.body;

    if (!siteKey || !fingerprint) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Calculate risk score
    const riskScore = calculateRiskScore({
      fingerprint,
      mouseMovements,
      keystrokes,
      requestTimings
    });

    // Create challenge
    const challengeId = crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    const expiresAt = now + 300000; // 5 minutes

    db.prepare(`
      INSERT INTO challenges (id, fingerprint, siteKey, riskScore, createdAt, expiresAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(challengeId, fingerprint, siteKey, riskScore, now, expiresAt);

    // Generate token
    const token = jwt.sign(
      { challengeId, fingerprint, siteKey },
      JWT_SECRET,
      { expiresIn: '5m' }
    );

    res.json({
      token,
      requiresInteraction: riskScore > 0.7,
      challengeId
    });

  } catch (error) {
    console.error('Create challenge error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify challenge
app.post('/api/challenge/verify', (req, res) => {
  try {
    const { token, fingerprint } = req.body;

    if (!token || !fingerprint) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify JWT
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token', success: false });
    }

    // Check fingerprint match
    if (decoded.fingerprint !== fingerprint) {
      const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
      logAbuse(ip, fingerprint, 'Fingerprint mismatch');
      return res.status(403).json({ error: 'Fingerprint mismatch', success: false });
    }

    // Get challenge
    const challenge = db.prepare('SELECT * FROM challenges WHERE id = ?').get(decoded.challengeId);

    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found', success: false });
    }

    if (challenge.expiresAt < Date.now()) {
      return res.status(410).json({ error: 'Challenge expired', success: false });
    }

    if (challenge.verified) {
      return res.status(400).json({ error: 'Challenge already verified', success: false });
    }

    // Mark as verified
    db.prepare('UPDATE challenges SET verified = 1 WHERE id = ?').run(decoded.challengeId);

    res.json({
      success: true,
      riskScore: challenge.riskScore
    });

  } catch (error) {
    console.error('Verify challenge error:', error);
    res.status(500).json({ error: 'Internal server error', success: false });
  }
});

// Verify token (for server-side validation)
app.post('/api/verify', (req, res) => {
  try {
    const { token, siteKey } = req.body;

    if (!token || !siteKey) {
      return res.status(400).json({ error: 'Missing required fields', success: false });
    }

    // Verify JWT
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token', success: false });
    }

    // Check site key
    if (decoded.siteKey !== siteKey) {
      return res.status(403).json({ error: 'Invalid site key', success: false });
    }

    // Get challenge
    const challenge = db.prepare('SELECT * FROM challenges WHERE id = ?').get(decoded.challengeId);

    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found', success: false });
    }

    if (!challenge.verified) {
      return res.status(400).json({ error: 'Challenge not verified', success: false });
    }

    if (challenge.expiresAt < Date.now()) {
      return res.status(410).json({ error: 'Challenge expired', success: false });
    }

    res.json({
      success: true,
      riskScore: challenge.riskScore,
      fingerprint: challenge.fingerprint
    });

  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({ error: 'Internal server error', success: false });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Start server
app.listen(PORT, () => {
  console.log(`SecuredCaptcha API running on http://localhost:${PORT}`);
  console.log(`Widget URL: http://localhost:${PORT}/widget.js`);
  console.log(`Demo URL: http://localhost:${PORT}/demo.html`);
});
