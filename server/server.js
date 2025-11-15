const express = require('express');
const mongoose = require('mongoose');
const redis = require('redis');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use(limiter);

// Environment variables from Render
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://fixpro648_db_user:fixpropisungg1952@fixpro648_db_user.c6acd5e.mongodb.net/loader?retryWrites=true&w=majority&appName=fixpro648_db_user';
const JWT_SECRET = process.env.JWT_SECRET || 'fixpropisungg1952_super_secret_key_2024_loader_app_security';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const PORT = process.env.PORT || 3000;

// MongoDB connection
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected successfully'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// Redis connection
let redisClient;
(async () => {
  try {
    redisClient = redis.createClient({ url: REDIS_URL });
    await redisClient.connect();
    console.log('✅ Redis connected successfully');
  } catch (err) {
    console.error('❌ Redis connection error:', err);
  }
})();

// MongoDB Schemas
const userSchema = new mongoose.Schema({
  hwid: { type: String, required: true, unique: true },
  nickname: { type: String, required: true },
  key: { type: String, required: true },
  role: { type: String, required: true, enum: ['premium', 'beta', 'coder', 'friend', 'trial'] },
  activatedAt: { type: Date, default: Date.now },
  lastSeen: { type: Date, default: Date.now },
  totalUsage: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
});

const keySchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  type: { type: String, required: true, enum: ['premium', 'beta', 'coder', 'friend', 'trial'] },
  usesLeft: { type: Number, default: 1 },
  maxUses: { type: Number, default: 1 },
  createdBy: { type: String, default: 'system' },
  createdAt: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true }
});

const User = mongoose.model('User', userSchema);
const Key = mongoose.model('Key', keySchema);

// Pre-defined keys
const PREDEFINED_KEYS = {
  'premium': ['PREMIUM-7X9F-2K4L-8M3N', 'PREMIUM-5T8R-1W6Q-9P2O'],
  'beta': ['BETA-7X2K-4L8M-3N9P', 'BETA-5T1W-6Q9P-2O3I'],
  'coder': ['CODER-F1X-PR0-ULTRA'],
  'friend': ['FRIEND-SP3C1AL-4CC3SS']
};

// Initialize keys in database
async function initializeKeys() {
  try {
    for (const [role, keys] of Object.entries(PREDEFINED_KEYS)) {
      for (const key of keys) {
        const existing = await Key.findOne({ key });
        if (!existing) {
          await Key.create({
            key,
            type: role,
            usesLeft: role === 'coder' ? 999 : 1,
            maxUses: role === 'coder' ? 999 : 1
          });
          console.log(`✅ Added key: ${key}`);
        }
      }
    }
    console.log('✅ All keys initialized');
  } catch (error) {
    console.error('❌ Key initialization error:', error);
  }
}

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    await mongoose.connection.db.admin().ping();
    if (redisClient) await redisClient.ping();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'Tamp. Cloud Server',
      version: '1.0.0'
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// Activation endpoint
app.post('/api/activate', async (req, res) => {
  const { nickname, key } = req.body;
  const hwid = req.headers['x-hwid'];

  if (!nickname || !key || !hwid) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  try {
    const keyDoc = await Key.findOne({ key: key.toUpperCase(), isActive: true });
    if (!keyDoc) {
      return res.json({ success: false, message: 'Invalid activation key' });
    }

    if (keyDoc.usesLeft <= 0) {
      return res.json({ success: false, message: 'Key has no uses left' });
    }

    const existingUser = await User.findOne({ hwid });
    if (existingUser) {
      return res.json({ success: false, message: 'Device already activated' });
    }

    // Create user
    const user = new User({
      hwid,
      nickname,
      key: key.toUpperCase(),
      role: keyDoc.type
    });

    // Update key uses
    if (keyDoc.type !== 'coder') {
      keyDoc.usesLeft -= 1;
      if (keyDoc.usesLeft <= 0) keyDoc.isActive = false;
    }

    await Promise.all([user.save(), keyDoc.save()]);

    res.json({
      success: true,
      role: keyDoc.type,
      message: 'Activation successful!'
    });

  } catch (error) {
    console.error('Activation error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Validation endpoint
app.post('/api/validate', async (req, res) => {
  const { hwid, key } = req.body;
  
  try {
    const user = await User.findOne({ hwid, key: key.toUpperCase(), isActive: true });
    if (user) {
      user.lastSeen = new Date();
      user.totalUsage += 1;
      await user.save();
      res.json({ valid: true, role: user.role });
    } else {
      res.json({ valid: false });
    }
  } catch (error) {
    res.status(500).json({ valid: false, error: error.message });
  }
});

// Script delivery endpoint
app.get('/api/script', async (req, res) => {
  const hwid = req.headers['x-hwid'];
  const key = req.headers['x-key'];

  try {
    const user = await User.findOne({ hwid, key: key.toUpperCase(), isActive: true });
    if (!user) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Basic script for testing
    const script = `
      (function() {
        console.log('⚡ Tamp. Cloud loaded for ${user.nickname} [${user.role}]');
        alert('Tamp. Cloud успешно загружен! Добро пожаловать, ${user.nickname}!');
      })();
    `;

    user.totalUsage += 1;
    user.lastSeen = new Date();
    await user.save();

    res.setHeader('Content-Type', 'application/javascript');
    res.send(script);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin endpoints
app.get('/api/admin/keys', async (req, res) => {
  const auth = req.headers['authorization'];
  if (!auth || !auth.includes('Bearer fixpro648_admin')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const keys = await Key.find().sort({ createdAt: -1 });
    res.json({ keys });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Initialize and start server
async function startServer() {
  await initializeKeys();
  
  app.listen(PORT, () => {
    console.log('=================================');
    console.log('🚀 Tamp. Cloud Server Started');
    console.log('📍 Port:', PORT);
    console.log('🌐 Environment:', process.env.NODE_ENV);
    console.log('=================================');
  });
}

startServer();

module.exports = app;