# MUSALYTICS Backend Deployment Guide

## 🚀 Quick Deployment Steps

### 1. Environment Setup
1. Copy `env.example` to `.env`
2. Fill in your production values:
   ```bash
   cp env.example .env
   ```

### 2. Required Environment Variables
```env
# Server Configuration
PORT=5000
NODE_ENV=production

# Firebase Configuration (REQUIRED)
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"musalytics1",...}

# Email Configuration (REQUIRED)
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password

# CORS Origins (REQUIRED for production)
CORS_ORIGINS=https://your-frontend-domain.com,https://your-admin-domain.com
```

### 3. Firebase Setup
1. Go to Firebase Console → Project Settings → Service Accounts
2. Generate new private key
3. Copy the JSON content to `FIREBASE_SERVICE_ACCOUNT` environment variable

### 4. Email Setup (Gmail)
1. Enable 2-factor authentication on Gmail
2. Generate App Password: Google Account → Security → App passwords
3. Use the app password (not your regular password)

### 5. Deploy to Railway/Render
1. Connect your GitHub repository
2. Set build command: `npm install`
3. Set start command: `npm start`
4. Add all environment variables in the platform's dashboard

## 🔒 Security Notes
- ✅ Hardcoded credentials removed
- ✅ Environment variables properly configured
- ✅ CORS origins configurable
- ✅ Firebase credentials secured

## 🧪 Testing Deployment
```bash
# Test locally with production config
NODE_ENV=production npm start

# Check health endpoint
curl http://localhost:5000/health
```

## 📝 Post-Deployment
1. Update frontend API URLs to point to your deployed backend
2. Test all endpoints
3. Monitor logs for any issues
