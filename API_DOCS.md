# API Documentation

## Base URL
```
https://api.yourdomain.com/api/v1
```

## Authentication

All API requests require authentication using either:
- JWT token in `Authorization: Bearer TOKEN` header
- API key in `X-API-Key: YOUR_KEY` header

---

## Endpoints

### Authentication

#### Register User
```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword",
  "name": "John Doe"
}
```

**Response:**
```json
{
  "message": "User registered successfully",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "name": "John Doe",
    "tier": "free"
  },
  "token": "jwt_token"
}
```

#### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword"
}
```

---

### API Keys

#### Create API Key
```http
POST /keys/create
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "name": "Production Key",
  "domains": ["example.com", "www.example.com"]
}
```

**Response:**
```json
{
  "message": "API key created successfully",
  "apiKey": {
    "id": "key_id",
    "name": "Production Key",
    "key": "sk_...",
    "siteKey": "pk_...",
    "secretKey": "secret_...",
    "domains": ["example.com", "www.example.com"]
  }
}
```

#### List API Keys
```http
GET /keys/list
Authorization: Bearer YOUR_JWT_TOKEN
```

---

### Challenge System

#### Create Challenge
```http
POST /challenge/create
Content-Type: application/json

{
  "siteKey": "pk_your_site_key",
  "action": "login",
  "fingerprint": "optional_fingerprint",
  "mouseMovements": [...],
  "keystrokes": [...]
}
```

**Response:**
```json
{
  "success": true,
  "challengeId": "challenge_uuid",
  "token": "challenge_token",
  "requiresInteraction": false,
  "expiresAt": "2026-01-05T15:00:00Z",
  "metadata": {
    "score": 95,
    "riskLevel": "low"
  }
}
```

#### Verify Challenge
```http
POST /challenge/verify
Content-Type: application/json

{
  "token": "challenge_token",
  "response": "optional_user_response",
  "fingerprint": "optional_fingerprint"
}
```

**Response:**
```json
{
  "success": true,
  "verified": true,
  "score": 95,
  "riskLevel": "low",
  "metadata": {
    "botScore": 5,
    "vpnDetected": false,
    "proxyDetected": false,
    "torDetected": false,
    "abuseScore": 0
  }
}
```

#### Check Challenge Status
```http
GET /challenge/status/:challengeId
```

---

### Billing & Usage

#### Get Usage Statistics
```http
GET /billing/usage
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response:**
```json
{
  "tier": "free",
  "currentUsage": 150,
  "limit": 1000,
  "remaining": 850,
  "percentage": 15,
  "dailyUsage": [
    { "_id": "2026-01-01", "count": 20 },
    { "_id": "2026-01-02", "count": 35 }
  ],
  "billingPeriod": {
    "start": "2026-01-01T00:00:00Z",
    "end": "2026-01-31T23:59:59Z"
  }
}
```

#### Create Checkout Session
```http
POST /billing/create-checkout
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "tier": "pro"
}
```

**Response:**
```json
{
  "sessionId": "cs_...",
  "url": "https://checkout.stripe.com/..."
}
```

---

## Rate Limits

| Tier | Requests/Month | Requests/Minute |
|------|----------------|-----------------|
| Free | 1,000 | 30 |
| Basic | 10,000 | 60 |
| Pro | 100,000 | 120 |
| Enterprise | 1,000,000+ | Unlimited |

---

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Invalid or missing authentication |
| 403 | Forbidden - Request blocked due to abuse |
| 404 | Not Found - Resource doesn't exist |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |

---

## Risk Levels

- **Low (0-25)**: Normal user behavior
- **Medium (26-50)**: Some suspicious signals
- **High (51-75)**: Multiple risk factors detected
- **Critical (76-100)**: Likely bot or malicious actor

---

## Widget Integration

### Basic Usage

```html
<script src="https://api.yourdomain.com/widget.js"></script>
<div id="secured-captcha"></div>

<script>
  SecuredCaptcha.render('secured-captcha', {
    siteKey: 'YOUR_SITE_KEY',
    callback: function(token) {
      // Send token to your server
      fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ captchaToken: token })
      });
    }
  });
</script>
```

### Server-Side Verification

```javascript
const response = await fetch('https://api.yourdomain.com/api/v1/challenge/verify', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'YOUR_SECRET_KEY'
  },
  body: JSON.stringify({
    token: captchaToken
  })
});

const result = await response.json();

if (result.success && result.score >= 70) {
  // Allow the action
} else {
  // Reject or require additional verification
}
```

---

## Webhooks

Configure webhooks in your dashboard to receive real-time notifications:

- `challenge.completed` - When a challenge is verified
- `challenge.failed` - When verification fails
- `abuse.detected` - When abuse is detected
- `usage.limit.reached` - When approaching usage limits

---

## Support

- Email: support@yourdomain.com
- Documentation: https://docs.yourdomain.com
- Status: https://status.yourdomain.com
