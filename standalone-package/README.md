# SecuredCaptcha - Standalone Package

A self-hosted CAPTCHA solution with advanced bot detection and behavioral analysis.

## What's Included

- **Client Widget** - Drop-in JavaScript widget for your website
- **Backend API** - Node.js/Express server for verification
- **SQLite Database** - Lightweight database (no external DB required)
- **Bot Detection** - Fingerprinting, behavioral analysis, rate limiting
- **Easy Setup** - Works out of the box with minimal configuration

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env and set your domain
```

### 3. Start the Server

```bash
npm start
```

The API will run on `http://localhost:3000` by default.

### 4. Add to Your Website

```html
<!-- Include the widget script -->
<script src="http://your-domain.com/widget.js"></script>

<!-- Create a container -->
<div id="captcha-container"></div>

<script>
  SecuredCaptcha.render('captcha-container', {
    siteKey: 'your-site-key-from-dashboard',
    callback: function(token) {
      console.log('Verification token:', token);
      // Send token to your server for validation
    }
  });
</script>
```

### 5. Verify on Your Server

```javascript
// On your backend, verify the token
const response = await fetch('http://your-captcha-server.com/api/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    token: userToken,
    siteKey: 'your-site-key'
  })
});

const result = await response.json();
if (result.success) {
  // User is verified!
}
```

## Configuration

### Environment Variables

- `PORT` - Server port (default: 3000)
- `JWT_SECRET` - Secret key for token signing
- `ALLOWED_ORIGINS` - CORS origins (comma-separated)
- `RATE_LIMIT_WINDOW_MS` - Rate limit window (default: 60000)
- `RATE_LIMIT_MAX_REQUESTS` - Max requests per window (default: 100)

### Customization

#### Widget Styling

You can customize the widget appearance:

```javascript
SecuredCaptcha.render('captcha-container', {
  siteKey: 'your-key',
  theme: 'light', // or 'dark'
  size: 'normal', // or 'compact'
  callback: yourCallback
});
```

#### Challenge Difficulty

Edit `server.js` to adjust bot detection sensitivity:

```javascript
const RISK_THRESHOLDS = {
  LOW: 0.3,    // Auto-verify if score < 0.3
  HIGH: 0.7    // Require interaction if score > 0.7
};
```

## API Endpoints

### Create Challenge
```
POST /api/challenge/create
```

### Verify Challenge
```
POST /api/challenge/verify
```

### Validate Token (for your backend)
```
POST /api/verify
```

## Security Features

- **Browser Fingerprinting** - Canvas, WebGL, user agent analysis
- **Behavioral Analysis** - Mouse movements, keystroke patterns
- **Rate Limiting** - IP-based request throttling
- **Risk Scoring** - Multi-factor bot detection algorithm
- **Token Expiry** - Time-limited verification tokens

## Production Deployment

### Update API URL

1. Edit `public/widget.js` and change:
```javascript
const API_URL = 'https://your-domain.com/api';
```

2. Set CORS origins in `.env`:
```
ALLOWED_ORIGINS=https://your-site.com,https://www.your-site.com
```

### Run with PM2 (recommended)

```bash
npm install -g pm2
pm2 start server.js --name "secured-captcha"
pm2 save
pm2 startup
```

### Use Process Manager

```bash
# Development
npm run dev

# Production
npm start
```

## Database Management

The system uses SQLite by default. Database file: `captcha.db`

### Reset Database

```bash
npm run reset-db
```

### Backup Database

```bash
cp captcha.db captcha.db.backup
```

## Troubleshooting

### CORS Errors
- Make sure your domain is listed in `ALLOWED_ORIGINS`
- Check that widget.js uses the correct API URL

### Widget Not Appearing
- Check browser console for errors
- Verify the script is loaded correctly
- Ensure container element exists

### Verification Failing
- Check that tokens haven't expired (5 minutes default)
- Verify siteKey matches between widget and server
- Check server logs for detailed error messages

## License

This package is licensed for use by the purchaser. See LICENSE.txt for details.

## Support

For questions or issues, contact the package provider.
