# Installation Guide

## Prerequisites

- Node.js 16+ installed
- npm or yarn package manager

## Step-by-Step Installation

### 1. Extract the Package

Unzip the package to your desired location:

```bash
unzip secured-captcha-standalone.zip
cd secured-captcha-standalone
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your settings
nano .env  # or use your preferred editor
```

**Important Settings:**

- `JWT_SECRET` - Change this to a random string for production
- `ALLOWED_ORIGINS` - Add your website domains
- `PORT` - Change if you need a different port

### 4. Start the Server

**Development Mode (with auto-reload):**
```bash
npm run dev
```

**Production Mode:**
```bash
npm start
```

The server will start on `http://localhost:3000` (or your configured PORT).

### 5. Update Widget URL

Edit `public/widget.js` and change the API_URL:

```javascript
const API_URL = 'https://your-domain.com/api';
```

Or set it globally before loading the widget:

```html
<script>
  window.SECURED_CAPTCHA_API_URL = 'https://your-domain.com/api';
</script>
<script src="https://your-domain.com/widget.js"></script>
```

### 6. Test the Demo

Open your browser to:
```
http://localhost:3000/demo.html
```

You should see the demo page with a working CAPTCHA.

## Production Deployment

### Using PM2 (Recommended)

```bash
# Install PM2
npm install -g pm2

# Start the application
pm2 start server.js --name secured-captcha

# Set to start on boot
pm2 startup
pm2 save
```

### Using Docker (Optional)

Create a `Dockerfile`:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

Build and run:

```bash
docker build -t secured-captcha .
docker run -p 3000:3000 -d secured-captcha
```

### Nginx Reverse Proxy

Example Nginx configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Troubleshooting

### Port Already in Use

Change the PORT in `.env`:
```
PORT=3001
```

### Database Locked

Reset the database:
```bash
npm run reset-db
```

### CORS Errors

Make sure your domain is in `ALLOWED_ORIGINS` in `.env`:
```
ALLOWED_ORIGINS=https://your-site.com,https://www.your-site.com
```

### Widget Not Loading

1. Check that the server is running
2. Verify the API_URL in widget.js
3. Check browser console for errors
4. Ensure CORS is configured correctly

## Next Steps

- Read [INTEGRATION.md](INTEGRATION.md) to add the widget to your website
- Customize the widget styling in `public/widget.js`
- Adjust risk scoring in `server.js`
- Set up HTTPS with Let's Encrypt for production

## Support

For issues or questions, contact the package provider.
