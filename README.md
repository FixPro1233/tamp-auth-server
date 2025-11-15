# Tamp. Cloud Secure Loader

🔐 Secure cloud-based activation system for Tamp. loader.

## 🏗️ Project Structure

- `server/` - Backend API for Render.com deployment
- `loader/` - Tampermonkey loader script for clients

## 🚀 Quick Start

1. **Deploy on Render:**
   - Connect GitHub repository
   - Select "Web Service"
   - Set root directory to `server/`
   - Build: `npm install`
   - Start: `npm start`

2. **Configure Environment:**
   - `MONGODB_URI`: Your MongoDB connection string
   - `JWT_SECRET`: Secret key for JWT tokens

3. **Update Loader:**
   - Replace `API_BASE` in loader with your Render URL

## 🔑 Default Keys
- PREMIUM-7X9F-2K4L-8M3N
- BETA-7X2K-4L8M-3N9P  
- CODER-F1X-PR0-ULTRA
- FRIEND-SP3C1AL-4CC3SS

## 📞 Endpoints
- `GET /api/health` - Health check
- `POST /api/activate` - User activation
- `POST /api/validate` - Session validation
- `GET /api/script` - Script delivery
