# Deployment Guide

## Overview

This guide covers deploying SecuredAPI to production environments.

## Production Checklist

### Security
- [ ] Change all default secrets and keys
- [ ] Enable HTTPS/TLS
- [ ] Configure firewall rules
- [ ] Set up rate limiting at reverse proxy
- [ ] Enable Redis for distributed rate limiting
- [ ] Use environment variables for secrets (never commit .env)
- [ ] Enable audit logging
- [ ] Set up security monitoring

### Performance
- [ ] Enable Redis caching
- [ ] Configure MongoDB indexes (auto-created by models)
- [ ] Use PM2 or similar process manager
- [ ] Set up load balancing if needed
- [ ] Enable gzip compression at reverse proxy
- [ ] Configure CDN for widget.js
- [ ] Optimize database queries

### Monitoring
- [ ] Set up application monitoring (PM2, New Relic, etc.)
- [ ] Configure error tracking (Sentry, etc.)
- [ ] Set up uptime monitoring
- [ ] Configure log aggregation
- [ ] Set up alerts for critical errors
- [ ] Monitor API usage and quotas

### Backup
- [ ] Automated MongoDB backups
- [ ] Redis persistence configuration
- [ ] Backup rotation policy
- [ ] Disaster recovery plan

## Deployment Options

### Option 1: VPS/Dedicated Server (Recommended)

#### Requirements
- Ubuntu 22.04 LTS or similar
- 2+ CPU cores
- 4GB+ RAM
- 20GB+ SSD storage

#### Setup Steps

1. **Install Dependencies**

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt update
sudo apt install -y mongodb-org

# Install Redis
sudo apt install -y redis-server

# Install PM2
sudo npm install -g pm2

# Install Nginx
sudo apt install -y nginx
```

2. **Configure MongoDB**

```bash
sudo systemctl start mongod
sudo systemctl enable mongod

# Create database user
mongosh
use secured-api
db.createUser({
  user: "securedapi",
  pwd: "STRONG_PASSWORD",
  roles: ["readWrite"]
})
```

3. **Configure Redis**

```bash
sudo systemctl start redis
sudo systemctl enable redis
```

4. **Deploy Application**

```bash
# Create app directory
sudo mkdir -p /var/www/secured-api
cd /var/www/secured-api

# Clone or upload your code
git clone YOUR_REPO .

# Install dependencies
npm ci --only=production

# Build
npm run build

# Create .env file
sudo nano .env
# Add production environment variables

# Start with PM2
pm2 start dist/index.js --name secured-api
pm2 save
pm2 startup
```

5. **Configure Nginx**

```bash
sudo nano /etc/nginx/sites-available/secured-api
```

Add configuration:

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    limit_req zone=api_limit burst=20 nodelay;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Cache widget.js
    location /widget.js {
        proxy_pass http://localhost:3000;
        proxy_cache_valid 200 1h;
        add_header Cache-Control "public, max-age=3600";
    }
}
```

Enable site:

```bash
sudo ln -s /etc/nginx/sites-available/secured-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

6. **Enable HTTPS with Let's Encrypt**

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```

### Option 2: Docker Deployment

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://mongo:27017/secured-api
      - REDIS_HOST=redis
      - REDIS_PORT=6379
    env_file:
      - .env
    depends_on:
      - mongo
      - redis
    restart: unless-stopped

  mongo:
    image: mongo:6
    volumes:
      - mongo-data:/data/db
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    restart: unless-stopped

volumes:
  mongo-data:
```

Deploy:

```bash
docker-compose up -d
```

### Option 3: Cloud Platforms

#### AWS (EC2 + MongoDB Atlas + ElastiCache)

1. Launch EC2 instance (t3.small or larger)
2. Use MongoDB Atlas for database
3. Use ElastiCache for Redis
4. Follow VPS setup steps
5. Configure security groups

#### DigitalOcean (App Platform)

1. Create App from Git repository
2. Add MongoDB database
3. Add Redis database
4. Configure environment variables
5. Deploy

#### Heroku

```bash
# Install Heroku CLI
heroku create secured-api

# Add MongoDB
heroku addons:create mongolab

# Add Redis
heroku addons:create heroku-redis

# Configure environment
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=your_secret

# Deploy
git push heroku main
```

## Environment Variables for Production

```env
# Server
PORT=3000
NODE_ENV=production
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Database
MONGODB_URI=mongodb://username:password@host:27017/secured-api?authSource=admin

# Redis
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password

# JWT
JWT_SECRET=GENERATE_STRONG_SECRET_HERE
JWT_EXPIRE=7d

# Stripe (Production Keys)
STRIPE_SECRET_KEY=sk_live_your_key
STRIPE_WEBHOOK_SECRET=whsec_your_secret

# External APIs
IPQUALITYSCORE_API_KEY=your_production_key
IPINFO_TOKEN=your_production_token

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Tier Limits
FREE_TIER_LIMIT=1000
BASIC_TIER_LIMIT=10000
PRO_TIER_LIMIT=100000
ENTERPRISE_TIER_LIMIT=1000000
```

## Monitoring Setup

### PM2 Monitoring

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### Log Management

```bash
# View logs
pm2 logs secured-api

# Clear logs
pm2 flush

# Monitor
pm2 monit
```

## Backup Strategy

### MongoDB Backup

```bash
#!/bin/bash
# backup-mongodb.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/mongodb"
mkdir -p $BACKUP_DIR

mongodump --uri="mongodb://username:password@localhost:27017/secured-api" \
  --out="$BACKUP_DIR/backup_$DATE"

# Keep only last 7 days
find $BACKUP_DIR -type d -mtime +7 -exec rm -rf {} +
```

Add to crontab:

```bash
crontab -e
# Add: 0 2 * * * /path/to/backup-mongodb.sh
```

## SSL/TLS Configuration

### Using Let's Encrypt (Recommended)

```bash
sudo certbot --nginx -d api.yourdomain.com
```

### Using Custom Certificate

Update Nginx configuration:

```nginx
server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    
    # ... rest of config
}
```

## Scaling Considerations

### Horizontal Scaling

1. Use load balancer (Nginx, HAProxy, AWS ALB)
2. Deploy multiple API instances
3. Use shared Redis for rate limiting
4. Use MongoDB replica set

### Vertical Scaling

1. Increase server resources (CPU, RAM)
2. Optimize Node.js memory usage
3. Use MongoDB indexes effectively
4. Enable Redis persistence

## Troubleshooting Production Issues

### High Memory Usage

```bash
# Check Node.js memory
pm2 show secured-api

# Restart if needed
pm2 restart secured-api
```

### Slow Responses

```bash
# Check MongoDB indexes
mongosh
use secured-api
db.challenges.getIndexes()

# Check Redis connection
redis-cli ping
```

### Connection Issues

```bash
# Check ports
sudo netstat -tulpn | grep LISTEN

# Check firewall
sudo ufw status
```

## Support and Updates

```bash
# Update application
cd /var/www/secured-api
git pull
npm ci --only=production
npm run build
pm2 restart secured-api
```

## Cost Estimates

### Small Scale (< 100K requests/month)
- VPS: $10-20/month (DigitalOcean, Linode)
- MongoDB Atlas: Free tier
- Redis: Included or $5/month
- **Total: ~$15-25/month**

### Medium Scale (< 1M requests/month)
- VPS: $40-80/month
- MongoDB Atlas: $57/month
- Redis: $15/month
- **Total: ~$110-150/month**

### Large Scale (> 1M requests/month)
- Multiple servers: $200+/month
- MongoDB Atlas: $200+/month
- Redis: $50+/month
- CDN: $50+/month
- **Total: ~$500+/month**
