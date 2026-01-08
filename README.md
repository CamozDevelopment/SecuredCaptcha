# SecuredAPI - Advanced CAPTCHA & Bot Detection Service

A comprehensive CAPTCHA and bot detection API service with VPN/proxy detection, abuse prevention, and a Cloudflare Turnstile-style widget.

## Features

- 🤖 **Advanced Bot Detection** - Browser fingerprinting, behavioral analysis, timing analysis
- 🛡️ **VPN & Proxy Detection** - Multi-source IP intelligence checking
- 🚫 **Abuse Prevention** - Rate limiting, pattern detection, automatic blocking
- 💰 **Tiered Pricing** - Free tier with usage limits, paid tiers with Stripe integration
- 🎨 **Easy Integration** - Turnstile-style widget for seamless integration
- 📊 **Analytics Dashboard** - Track usage, detect patterns, manage API keys
- ⚡ **High Performance** - Redis caching, optimized algorithms
- 🔒 **Secure** - JWT authentication, API key management, encrypted data

## Pricing Tiers

| Tier | Monthly Requests | Price |
|------|-----------------|-------|
| Free | 1,000 | $0 |
| Basic | 10,000 | $19/mo |
| Pro | 100,000 | $99/mo |
| Enterprise | 1,000,000+ | Custom |

## Installation

```bash
npm install
```

## Configuration

1. Copy `.env.example` to `.env`
2. Configure your Neon PostgreSQL connection
3. Run `npx prisma generate` and `npx prisma db push`
4. Add your Stripe API keys
5. Configure external API keys for IP intelligence (optional but recommended)

## Development

```bash
npm run dev
```

## Build

```bash
npm run build
npm start
```

## API Documentation

### Create Challenge

```http
POST /api/v1/challenge/create
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

{
  "siteKey": "your-site-key",
  "action": "login"
}
```

### Verify Challenge

```http
POST /api/v1/challenge/verify
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

{
  "token": "challenge-token",
  "response": "user-response"
}
```

## Widget Integration

```html
<script src="https://api.yourdomain.com/widget.js"></script>
<div id="secured-captcha"></div>

<script>
  SecuredCaptcha.render('secured-captcha', {
    siteKey: 'YOUR_SITE_KEY',
    callback: function(token) {
      console.log('Challenge completed:', token);
    }
  });
</script>
```

## Technologies

- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL (Neon), Redis (optional)
- **ORM**: Prisma
- **Payment**: Stripe
- **Security**: JWT, bcrypt, Helmet
- **Detection**: Canvas fingerprinting, UA parsing, GeoIP

## License

MIT
