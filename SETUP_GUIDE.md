# SecuredAPI - Setup Guide

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+ (Neon recommended)
- Redis 7+ (optional but recommended)
- Stripe account (for payments)

## Installation Steps

### 1. Clone and Install Dependencies

```bash
cd SecuredAPI
npm install
```

### 2. Environment Configuration

Copy the example environment file:

```bash
copy .env.example .env
```

Edit `.env` and configure:

```env
# Server
PORT=3000
NODE_ENV=development

# Database (Neon PostgreSQL)
DATABASE_URL=postgresql://username:password@your-neon-host.neon.tech/dbname?sslmode=require

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_EXPIRE=7d

# Stripe
STRIPE_SECRET_KEY=sk_test_your_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# External APIs (Optional but Recommended)
IPQUALITYSCORE_API_KEY=your_key
IPINFO_TOKEN=your_token
```

### 3. Database Setup

#### PostgreSQL (Neon)

Create a Neon PostgreSQL database:
1. Sign up at https://neon.tech
2. Create a new project
3. Copy the connection string to your `.env` as `DATABASE_URL`

Generate Prisma client and push schema:

```bash
npx prisma generate
npx prisma db push
```

#### Redis (optional):

```bash
# Windows
redis-server

# Or using Docker
docker run -d -p 6379:6379 --name redis redis:latest
```

### 4. Build and Run

Development mode:

```bash
npm run dev
```

Production build:

```bash
npm run build
npm start
```

### 5. Verify Installation

Open your browser:

- API Health: http://localhost:3000/health
- Widget Demo: http://localhost:3000/demo
- Dashboard: http://localhost:3000/dashboard.html

## First Steps

### 1. Create an Account

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your@email.com",
    "password": "securepassword",
    "name": "Your Name"
  }'
```

Save the returned JWT token.

### 2. Create API Key

```bash
curl -X POST http://localhost:3000/api/v1/keys/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "My First Key",
    "domains": ["localhost", "yourdomain.com"]
  }'
```

Save the `siteKey` and `secretKey`.

### 3. Test the Widget

Edit `public/demo.html` and replace `demo-site-key` with your actual site key, then visit:

```
http://localhost:3000/demo
```

## Stripe Setup (for Payments)

1. Create a Stripe account at https://stripe.com
2. Get your API keys from Dashboard > Developers > API keys
3. Create products and prices in Stripe Dashboard:
   - Basic Plan: $19/month
   - Pro Plan: $99/month
   - Enterprise Plan: $499/month
4. Update price IDs in `src/routes/billing.ts`
5. Set up webhook endpoint:
   - URL: `https://yourdomain.com/api/v1/billing/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`

## External API Services (Optional)

### IPQualityScore

1. Sign up at https://www.ipqualityscore.com/
2. Get API key from dashboard
3. Add to `.env`: `IPQUALITYSCORE_API_KEY=your_key`

### IPInfo

1. Sign up at https://ipinfo.io/
2. Get token from dashboard
3. Add to `.env`: `IPINFO_TOKEN=your_token`

These services enhance VPN/proxy detection but are optional.

## Deployment

### Using PM2 (Recommended)

```bash
npm install -g pm2

# Build
npm run build

# Start with PM2
pm2 start dist/index.js --name secured-api

# Save PM2 config
pm2 save

# Setup startup script
pm2 startup
```

### Using Docker

Create `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

Build and run:

```bash
docker build -t secured-api .
docker run -d -p 3000:3000 --name secured-api secured-api
```

### Environment Variables in Production

Make sure to set secure values:

- Change `JWT_SECRET` to a strong random string
- Use production Stripe keys
- Set `NODE_ENV=production`
- Configure proper CORS origins
- Enable HTTPS

## Security Checklist

- [ ] Change default JWT secret
- [ ] Use strong passwords for database
- [ ] Enable HTTPS/SSL
- [ ] Configure firewall rules
- [ ] Set up rate limiting at reverse proxy level
- [ ] Enable Redis for better performance
- [ ] Regular backups of MongoDB
- [ ] Monitor logs for suspicious activity
- [ ] Keep dependencies updated

## Monitoring

View logs:

```bash
# Development
npm run dev

# Production with PM2
pm2 logs secured-api
```

Log files location: `logs/`

## Troubleshooting

### MongoDB Connection Issues

```bash
# Check if MongoDB is running
mongosh --eval "db.version()"

# Check connection string in .env
```

### Redis Connection Issues

Redis is optional. If unavailable, the system will work without caching:

```bash
# Check if Redis is running
redis-cli ping
```

### Port Already in Use

```bash
# Change PORT in .env
PORT=3001
```

### CORS Issues

Add your domain to `ALLOWED_ORIGINS` in `.env`:

```env
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com
```

## Support

- GitHub Issues: [Your Repo]
- Email: support@yourdomain.com
- Documentation: See API_DOCS.md

## Next Steps

1. Customize the widget styling in `public/widget.js`
2. Add custom detection rules in `src/services/botDetection.ts`
3. Configure additional IP intelligence providers
4. Set up monitoring and alerts
5. Create custom abuse detection patterns
6. Build admin dashboard features
7. Add email notifications
8. Implement webhooks for your clients

## License

MIT License - See LICENSE file for details
