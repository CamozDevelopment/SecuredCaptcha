# Changelog

## Version 1.0.0 - Initial Release

### Features

- ✅ Self-hosted CAPTCHA solution
- ✅ Advanced bot detection with fingerprinting
- ✅ Behavioral analysis (mouse movements, keystrokes)
- ✅ Risk scoring algorithm
- ✅ Rate limiting per IP
- ✅ SQLite database (no external DB required)
- ✅ JWT token-based verification
- ✅ Interactive challenge for high-risk users
- ✅ Customizable widget styling
- ✅ RESTful API
- ✅ CORS support
- ✅ Demo page included
- ✅ Complete documentation

### Security Features

- Browser fingerprinting (Canvas + WebGL)
- Behavioral pattern analysis
- Request timing analysis
- IP-based rate limiting
- Token expiration (5 minutes)
- Abuse logging
- Fingerprint validation

### API Endpoints

- `POST /api/challenge/create` - Create new challenge
- `POST /api/challenge/verify` - Verify challenge completion
- `POST /api/verify` - Server-side token validation
- `GET /health` - Health check

### Files Included

- `server.js` - Main API server
- `public/widget.js` - Client widget
- `public/demo.html` - Demo page
- `package.json` - Dependencies
- `.env.example` - Configuration template
- `README.md` - Overview and quick start
- `INSTALL.md` - Installation guide
- `INTEGRATION.md` - Integration guide
- `LICENSE.txt` - License agreement

### Requirements

- Node.js 16+
- npm or yarn

### Known Limitations

- SQLite database (suitable for small to medium traffic)
- No admin dashboard (keys are simple strings)
- No analytics/reporting
- Basic styling (customizable via CSS)

### Future Enhancements (Not Included)

- Admin dashboard
- Database migration to PostgreSQL/MySQL
- Analytics and reporting
- More challenge types
- Image-based challenges
- Advanced risk scoring with ML

---

For support or feature requests, contact the package provider.
