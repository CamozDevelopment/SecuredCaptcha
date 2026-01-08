# Getting Started with SecuredAPI

Welcome! This guide will help you get your CAPTCHA API up and running in minutes.

## 📋 Prerequisites

Before you begin, make sure you have:

- **Node.js 18+** - [Download here](https://nodejs.org/)
- **PostgreSQL** (Neon recommended) - [Sign up here](https://neon.tech)
- **Redis** (optional) - [Download here](https://redis.io/download)
- **Stripe Account** (for payments) - [Sign up here](https://stripe.com)

## 🚀 Quick Start (5 Minutes)

### Step 1: Install Dependencies

**Option A: Using the installation script (Windows)**
```bash
install.bat
```

**Option B: Manual installation**
```bash
npm install
```

### Step 2: Configure Environment

The `.env` file has been created for you. You just need to:

1. **Add your Neon PostgreSQL connection string** (REQUIRED)
   - Sign up at [Neon](https://neon.tech)
   - Create a new project
   - Copy the connection string
   - Open `.env`
   - Replace `DATABASE_URL` with your connection string

2. **Change the JWT secret** (REQUIRED)
   - Open `.env`
   - Find: `JWT_SECRET=change-this-to-a-random-secret-key-in-production`
   - Replace with a strong random string (e.g., generate one [here](https://randomkeygen.com/))

3. **Add Stripe keys** (Optional for now, required for payments)
   - Get your keys from [Stripe Dashboard](https://dashboard.stripe.com/apikeys)
   - Add them to `.env`:
     ```
     STRIPE_SECRET_KEY=sk_test_your_key
     STRIPE_WEBHOOK_SECRET=whsec_your_secret
     ```

### Step 3: Initialize Database

Run Prisma migrations:
```bash
npx prisma generate
npx prisma db push
```

### Step 4: Start the Server

**Option A: Using the start script (Windows)**
```bash
start.bat
```

**Option B: Manual start**
```bash
npm run dev
```

### Step 5: Test It Out!

Open your browser and visit:

- **Widget Demo**: http://localhost:3000/demo
- **Health Check**: http://localhost:3000/health
- **Dashboard**: http://localhost:3000/dashboard.html

🎉 **Congratulations!** Your CAPTCHA API is now running!

## 🎯 Your First Integration

### 1. Create an Account

Open your terminal and run:

```bash
curl -X POST http://localhost:3000/api/v1/auth/register -H "Content-Type: application/json" -d "{\"email\":\"your@email.com\",\"password\":\"yourpassword\",\"name\":\"Your Name\"}"
```

Save the JWT token from the response.

### 2. Create an API Key

```bash
curl -X POST http://localhost:3000/api/v1/keys/create -H "Authorization: Bearer YOUR_JWT_TOKEN" -H "Content-Type: application/json" -d "{\"name\":\"My First Key\",\"domains\":[\"localhost\"]}"
```

Save the `siteKey` and `secretKey` from the response.

### 3. Add Widget to Your Website

Create a simple HTML file:

```html
<!DOCTYPE html>
<html>
<head>
  <title>My Protected Form</title>
</head>
<body>
  <h1>Contact Form</h1>
  
  <form id="myForm">
    <input type="email" placeholder="Email" required>
    <textarea placeholder="Message" required></textarea>
    
    <!-- Add the CAPTCHA widget here -->
    <div id="secured-captcha"></div>
    
    <button type="submit" id="submitBtn" disabled>Submit</button>
  </form>

  <!-- Load the widget -->
  <script src="http://localhost:3000/widget.js"></script>
  
  <script>
    let captchaToken = null;
    
    // Render the CAPTCHA
    SecuredCaptcha.render('secured-captcha', {
      siteKey: 'YOUR_SITE_KEY_HERE', // Replace with your site key
      callback: function(token) {
        captchaToken = token;
        document.getElementById('submitBtn').disabled = false;
        console.log('Verified! Token:', token);
      }
    });
    
    // Handle form submission
    document.getElementById('myForm').onsubmit = async (e) => {
      e.preventDefault();
      
      // Send to your backend for verification
      const response = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: e.target[0].value,
          message: e.target[1].value,
          captchaToken: captchaToken
        })
      });
      
      alert('Form submitted!');
    };
  </script>
</body>
</html>
```

### 4. Verify on Your Backend

In your server code:

```javascript
// Node.js/Express example
app.post('/api/submit', async (req, res) => {
  const { captchaToken, email, message } = req.body;
  
  // Verify the CAPTCHA with SecuredAPI
  const verifyResponse = await fetch('http://localhost:3000/api/v1/challenge/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': 'YOUR_SECRET_KEY_HERE' // Your secret key
    },
    body: JSON.stringify({ token: captchaToken })
  });
  
  const result = await verifyResponse.json();
  
  if (result.success && result.score >= 70) {
    // User is verified, process the form
    console.log('Legitimate user! Score:', result.score);
    res.json({ success: true });
  } else {
    // Reject the submission
    console.log('Bot detected! Score:', result.score);
    res.status(403).json({ error: 'Verification failed' });
  }
});
```

## 📊 Understanding the Scores

- **Score 90-100**: Extremely low risk (likely human)
- **Score 70-89**: Low risk (probably human)
- **Score 40-69**: Medium risk (suspicious)
- **Score 0-39**: High risk (likely bot)

You can adjust the threshold based on your needs.

## 🎨 Customizing the Widget

The widget can be customized with options:

```javascript
SecuredCaptcha.render('secured-captcha', {
  siteKey: 'YOUR_SITE_KEY',
  theme: 'light', // or 'dark'
  size: 'normal', // or 'compact'
  callback: function(token) {
    console.log('Token:', token);
  }
});
```

## 🔍 Monitoring Usage

### View Your Dashboard

Visit http://localhost:3000/dashboard.html to see:
- Monthly usage statistics
- API key management
- Recent activity logs
- Threat detection events

### Check Usage via API

```bash
curl http://localhost:3000/api/v1/billing/usage -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 💡 Common Use Cases

### 1. Contact Forms
Prevent spam submissions on contact forms

### 2. Login Pages
Add extra security layer to login attempts

### 3. Registration Forms
Block bot registrations

### 4. Comment Sections
Prevent spam comments

### 5. E-commerce Checkout
Prevent fraudulent orders

### 6. API Rate Limiting
Protect API endpoints from abuse

## 🐛 Troubleshooting

### "Cannot connect to MongoDB"
- Make sure MongoDB is running: `net start MongoDB`
- Check the connection string in `.env`

### "Port 3000 already in use"
- Change the PORT in `.env`: `PORT=3001`
- Or stop the process using port 3000

### "CAPTCHA widget not loading"
- Check browser console for errors
- Make sure the server is running
- Verify the siteKey is correct

### "Verification always fails"
- Make sure you're using the correct secretKey
- Check that the token hasn't expired (5 minutes default)
- Verify the API endpoint URL is correct

## 📚 Next Steps

### Learn More
- **[API Documentation](API_DOCS.md)** - Complete API reference
- **[Setup Guide](SETUP_GUIDE.md)** - Detailed configuration
- **[Deployment Guide](DEPLOYMENT.md)** - Production deployment

### Enhance Your Setup
1. Enable Redis for better performance
2. Configure external IP intelligence APIs
3. Set up Stripe for payment processing
4. Customize detection rules
5. Add email notifications

### Go to Production
1. Change JWT_SECRET to a secure value
2. Use production Stripe keys
3. Enable HTTPS/SSL
4. Set NODE_ENV=production
5. Use a proper domain name
6. Follow the [Deployment Guide](DEPLOYMENT.md)

## 💬 Need Help?

- **Documentation**: Check the docs folder
- **Issues**: Create a GitHub issue
- **Email**: support@yourdomain.com

## 🎉 You're Ready!

You now have a fully functional CAPTCHA API that can:
- ✅ Detect bots and automated traffic
- ✅ Block VPNs and proxies
- ✅ Prevent abuse and spam
- ✅ Track usage and analytics
- ✅ Handle payments and subscriptions

Happy coding! 🚀

---

**Quick Commands Reference:**

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# View logs
# (logs folder after running)
```
