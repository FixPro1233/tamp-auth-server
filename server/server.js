const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

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

// Environment variables
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://fixpro648_db_user:fixpropisungg1952@fixpro648_db_user.c6acd5e.mongodb.net/loader?retryWrites=true&w=majority&appName=fixpro648_db_user';
const JWT_SECRET = process.env.JWT_SECRET || 'fixpropisungg1952_super_secret_key_2024_loader_app_security';
const PORT = process.env.PORT || 3000;

// MongoDB connection
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected successfully'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// MongoDB Schemas
const userSchema = new mongoose.Schema({
  hwid: { type: String, required: true, unique: true },
  nickname: { type: String, required: true },
  key: { type: String, required: true },
  role: { type: String, required: true, enum: ['premium', 'beta', 'coder', 'friend', 'trial'] },
  activatedAt: { type: Date, default: Date.now },
  lastSeen: { type: Date, default: Date.now },
  totalUsage: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  ip: String,
  userAgent: String
});

const keySchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  type: { type: String, required: true, enum: ['premium', 'beta', 'coder', 'friend', 'trial'] },
  usesLeft: { type: Number, default: 1 },
  maxUses: { type: Number, default: 1 },
  createdBy: { type: String, default: 'system' },
  createdAt: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true },
  note: String
});

const activationSchema = new mongoose.Schema({
  hwid: String,
  key: String,
  nickname: String,
  role: String,
  ip: String,
  userAgent: String,
  timestamp: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Key = mongoose.model('Key', keySchema);
const Activation = mongoose.model('Activation', activationSchema);

// Pre-defined keys
const PREDEFINED_KEYS = {
  'premium': [
    'PREMIUM-7X9F-2K4L-8M3N', 'PREMIUM-5T8R-1W6Q-9P2O', 'PREMIUM-3V7B-4C9X-6Z1M',
    'PREMIUM-8N3D-2F7G-1H4J', 'PREMIUM-6K8L-9Q2W-5E3R', 'PREMIUM-4S5D-7F8G-9H0J',
    'PREMIUM-2K3L-4M5N-6B7V', 'PREMIUM-1Q2W-3E4R-5T6Y', 'PREMIUM-9Z8X-7C6V-5B4N',
    'PREMIUM-3M2N-1B4V-6C5X', 'PREMIUM-7U8I-9O0P-1K2J', 'PREMIUM-5H6G-7F8D-9S0A',
    'PREMIUM-2W3E-4R5T-6Y7U', 'PREMIUM-8I9O-0P1K-2J3H', 'PREMIUM-4F5G-6H7J-8K9L',
    'PREMIUM-1Z2X-3C4V-5B6N', 'PREMIUM-7Q8W-9E0R-1T2Y', 'PREMIUM-3U4I-5O6P-7K8J',
    'PREMIUM-9L0K-1M2N-3B4V', 'PREMIUM-5S6D-7F8G-9H0J', 'PREMIUM-2E3R-4T5Y-6U7I',
    'PREMIUM-8O9P-0K1J-2H3G', 'PREMIUM-4M5N-6B7V-8C9X', 'PREMIUM-1W2Q-3E4R-5T6Y',
    'PREMIUM-7Z8X-9C0V-1B2N', 'PREMIUM-3K4L-5M6N-7B8V', 'PREMIUM-9F0G-1H2J-3K4L',
    'PREMIUM-5D6S-7A8F-9G0H', 'PREMIUM-2R3T-4Y5U-6I7O', 'PREMIUM-8P9O-0I1U-2Y3T'
  ],
  'beta': [
    'BETA-7X2K-4L8M-3N9P', 'BETA-5T1W-6Q9P-2O3I', 'BETA-3V4C-9X6Z-1M2K',
    'BETA-8N2F-7G1H-4J5K', 'BETA-6K9Q-2W5E-3R4T', 'BETA-4S7F-8G9H-0J1K',
    'BETA-2K4M-5N6B-7V8C', 'BETA-1Q3E-4R5T-6Y7U', 'BETA-9Z7C-6V5B-4N3M',
    'BETA-3M1B-4V6C-5X7Z'
  ],
  'coder': [
    'CODER-F1X-PR0-ULTRA'
  ],
  'friend': [
    'FRIEND-SP3C1AL-4CC3SS', 'FRIEND-V1P-TR34T-M3NT', 'FRIEND-B3ST-BUDD13S'
  ]
};

// Initialize predefined keys in database
async function initializeKeys() {
  try {
    let keysAdded = 0;
    
    for (const [role, keys] of Object.entries(PREDEFINED_KEYS)) {
      for (const key of keys) {
        const existingKey = await Key.findOne({ key });
        if (!existingKey) {
          await Key.create({
            key,
            type: role,
            usesLeft: role === 'coder' ? 999 : 1,
            maxUses: role === 'coder' ? 999 : 1,
            createdBy: 'system',
            note: 'Pre-defined key'
          });
          keysAdded++;
          console.log(`✅ Added key: ${key} (${role})`);
        }
      }
    }
    
    console.log(`✅ Keys initialization complete. Added ${keysAdded} new keys.`);
  } catch (error) {
    console.error('❌ Error initializing keys:', error);
  }
}

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    // Check MongoDB
    await mongoose.connection.db.admin().ping();
    
    // Get basic stats
    const totalUsers = await User.countDocuments({ isActive: true });
    const totalKeys = await Key.countDocuments({ isActive: true });
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      stats: {
        totalUsers,
        totalKeys,
        serverUptime: process.uptime()
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Statistics endpoint
app.get('/api/stats', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ isActive: true });
    const totalActivations = await Activation.countDocuments();
    
    // Get role distribution
    const roleStats = {};
    for (const role of ['premium', 'beta', 'coder', 'friend']) {
      roleStats[role] = await User.countDocuments({ role, isActive: true });
    }
    
    res.json({
      totalUsers,
      totalActivations,
      roleDistribution: roleStats,
      serverTime: new Date().toISOString(),
      uptime: Math.floor(process.uptime())
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Activation endpoint
app.post('/api/activate', async (req, res) => {
  const { nickname, key } = req.body;
  const hwid = req.headers['x-hwid'];
  const ip = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent');

  if (!nickname || !key || !hwid) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  try {
    // Find the key
    const keyDoc = await Key.findOne({ key: key.toUpperCase(), isActive: true });
    if (!keyDoc) {
      return res.json({ success: false, message: '❌ Неверный ключ активации' });
    }

    if (keyDoc.usesLeft <= 0) {
      return res.json({ success: false, message: '❌ Этот ключ уже использован' });
    }

    // Check if HWID already activated
    const existingUser = await User.findOne({ hwid, isActive: true });
    if (existingUser) {
      return res.json({ 
        success: false, 
        message: '❌ Это устройство уже активировано',
        existingRole: existingUser.role
      });
    }

    // Check if key was already used by someone else (for non-coder keys)
    if (keyDoc.type !== 'coder') {
      const keyUsed = await User.findOne({ key: key.toUpperCase() });
      if (keyUsed && keyUsed.hwid !== hwid) {
        return res.json({ success: false, message: '❌ Этот ключ уже используется другим пользователем' });
      }
    }

    // Create user
    const user = new User({
      hwid,
      nickname,
      key: key.toUpperCase(),
      role: keyDoc.type,
      ip,
      userAgent
    });

    // Decrement key uses (except for coder)
    if (keyDoc.type !== 'coder') {
      keyDoc.usesLeft -= 1;
      if (keyDoc.usesLeft <= 0) {
        keyDoc.isActive = false;
      }
    }

    // Record activation
    const activation = new Activation({
      hwid,
      key: key.toUpperCase(),
      nickname,
      role: keyDoc.type,
      ip,
      userAgent
    });

    await Promise.all([user.save(), keyDoc.save(), activation.save()]);

    console.log(`✅ New activation: ${nickname} (${keyDoc.type}) - HWID: ${hwid}`);

    res.json({
      success: true,
      role: keyDoc.type,
      message: `✅ Активация успешна! Добро пожаловать, ${nickname}!`
    });

  } catch (error) {
    console.error('Activation error:', error);
    res.status(500).json({ success: false, message: '❌ Ошибка сервера при активации' });
  }
});

// Validation endpoint
app.post('/api/validate', async (req, res) => {
  const { hwid, key } = req.body;
  
  try {
    const user = await User.findOne({ hwid, key: key.toUpperCase(), isActive: true });
    if (user) {
      // Update last seen and usage count
      user.lastSeen = new Date();
      user.totalUsage += 1;
      await user.save();
      
      res.json({ 
        valid: true, 
        role: user.role,
        nickname: user.nickname,
        totalUsage: user.totalUsage
      });
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
  const nickname = req.headers['x-nickname'];
  
  try {
    // Validate user
    const user = await User.findOne({ hwid, key: key.toUpperCase(), isActive: true });
    if (!user) {
      return res.status(403).json({ error: 'Access denied. Please activate your account.' });
    }

    // Read and prepare the main tamp.js script
    const scriptPath = path.join(__dirname, 'tamp.js');
    let script = fs.readFileSync(scriptPath, 'utf8');
    
    // Replace placeholders with actual user data
    script = script.replace(/USER_ROLE = cloudData\.role \|\| 'user'/, `USER_ROLE = '${user.role}'`);
    script = script.replace(/USER_NAME = cloudData\.nickname \|\| 'Player'/, `USER_NAME = '${user.nickname}'`);
    script = script.replace(/USER_HWID = cloudData\.hwid/, `USER_HWID = '${user.hwid}'`);

    // Update usage stats
    user.totalUsage += 1;
    user.lastSeen = new Date();
    await user.save();

    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('X-Script-Version', '6.0.0');
    res.setHeader('X-User-Role', user.role);
    
    res.send(script);

  } catch (error) {
    console.error('Script delivery error:', error);
    res.status(500).json({ error: 'Failed to load script' });
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
    const stats = {
      total: keys.length,
      active: keys.filter(k => k.isActive).length,
      used: keys.filter(k => k.usesLeft === 0).length
    };
    
    res.json({ keys, stats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/keys', async (req, res) => {
  const auth = req.headers['authorization'];
  if (!auth || !auth.includes('Bearer fixpro648_admin')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { type, count = 1, maxUses = 1, note } = req.body;
  
  try {
    const newKeys = [];
    for (let i = 0; i < count; i++) {
      const key = generateKey(type);
      const keyDoc = new Key({
        key,
        type,
        maxUses,
        usesLeft: maxUses,
        createdBy: 'admin',
        note
      });
      await keyDoc.save();
      newKeys.push(key);
    }
    
    res.json({ success: true, keys: newKeys });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/users', async (req, res) => {
  const auth = req.headers['authorization'];
  if (!auth || !auth.includes('Bearer fixpro648_admin')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const users = await User.find().sort({ lastSeen: -1 });
    const activations = await Activation.find().sort({ timestamp: -1 }).limit(50);
    
    res.json({ users, recentActivations: activations });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function generateKey(type) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 12; i++) {
    if (i > 0 && i % 4 === 0) result += '-';
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return type.toUpperCase() + '-' + result;
}

// Initialize and start server
async function startServer() {
  await initializeKeys();
  
  app.listen(PORT, () => {
    console.log('=================================');
    console.log('🚀 Tamp. Cloud Server Started');
    console.log('📍 Port:', PORT);
    console.log('🌐 Environment:', process.env.NODE_ENV || 'development');
    console.log('🗄️  Database:', 'MongoDB Atlas');
    console.log('=================================');
  });
}

startServer();

module.exports = app;
