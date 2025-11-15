const express = require('express');
const mongoose = require('mongoose');
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

// Environment variables
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://fixpro648_db_user:fixpropisungg1952@fixpro648_db_user.c6acd5e.mongodb.net/loader?retryWrites=true&w=majority&appName=fixpro648_db_user';
const PORT = process.env.PORT || 3000;

// MongoDB connection
console.log('🔧 Starting server initialization...');

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('✅ MongoDB connected successfully');
})
.catch(err => {
  console.error('❌ MongoDB connection error:', err.message);
});

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

// 🔑 GENERATE NEW KEYS
function generateKey(prefix, length = 16) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let key = prefix + '-';
  
  for (let i = 0; i < length; i++) {
    if (i > 0 && i % 4 === 0) key += '-';
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
}

// NEW KEY SET
const NEW_KEYS = {
  'premium': Array.from({length: 25}, () => generateKey('PREMIUM')),
  'beta': Array.from({length: 10}, () => generateKey('BETA')),
  'friend': Array.from({length: 5}, () => generateKey('FRIEND')),
  'coder': [generateKey('CODER')],
  'trial': Array.from({length: 5}, () => generateKey('TRIAL'))
};

console.log('🔑 Generated Keys:');
Object.entries(NEW_KEYS).forEach(([type, keys]) => {
  console.log(`${type.toUpperCase()}: ${keys.length} keys`);
  keys.forEach(key => console.log(`  ${key}`));
});

// Initialize keys in database
async function initializeKeys() {
  try {
    console.log('🔑 Initializing keys...');
    
    if (mongoose.connection.readyState !== 1) {
      console.log('⏳ Waiting for MongoDB connection...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    if (mongoose.connection.readyState !== 1) {
      console.log('❌ MongoDB not connected, skipping key initialization');
      return;
    }

    let initializedCount = 0;
    for (const [role, keys] of Object.entries(NEW_KEYS)) {
      for (const key of keys) {
        try {
          const existing = await Key.findOne({ key });
          if (!existing) {
            await Key.create({
              key,
              type: role,
              usesLeft: role === 'coder' ? 999 : 1,
              maxUses: role === 'coder' ? 999 : 1
            });
            console.log(`✅ Added key: ${key}`);
            initializedCount++;
          }
        } catch (error) {
          console.log(`⚠️ Key ${key} already exists or error:`, error.message);
        }
      }
    }
    console.log(`✅ Keys initialization complete. Total: ${initializedCount}`);
  } catch (error) {
    console.error('❌ Key initialization error:', error.message);
  }
}

// Simple memory fallback
const memoryStorage = {
  users: new Map(),
  keys: new Map(),
  activations: new Map() // HWID to key mapping
};

// Initialize memory storage
function initializeMemoryStorage() {
  console.log('💾 Initializing memory storage...');
  for (const [role, keys] of Object.entries(NEW_KEYS)) {
    for (const key of keys) {
      memoryStorage.keys.set(key, {
        key,
        type: role,
        usesLeft: role === 'coder' ? 999 : 1,
        maxUses: role === 'coder' ? 999 : 1,
        isActive: true
      });
    }
  }
  console.log(`✅ Memory storage initialized with ${memoryStorage.keys.size} keys`);
}

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'Tamp. Cloud Server v2.1.0',
      version: '2.1.0',
      database: dbStatus,
      memoryUsers: memoryStorage.users.size,
      memoryKeys: memoryStorage.keys.size,
      features: ['HWID Activation', 'Role System', 'Key Management']
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// Enhanced Activation endpoint with HWID tracking
app.post('/api/activate', async (req, res) => {
  const { nickname, key } = req.body;
  const hwid = req.headers['x-hwid'];

  console.log('🔑 Activation attempt:', { 
    nickname: nickname?.substring(0, 8), 
    key: key?.toUpperCase(), 
    hwid: hwid?.substring(0, 10) + '...' 
  });

  if (!nickname || !key || !hwid) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  // Validate nickname length
  if (nickname.length > 8) {
    return res.status(400).json({ success: false, message: 'Nickname must be 8 characters or less' });
  }

  try {
    const cleanKey = key.toUpperCase().trim();
    const cleanNickname = nickname.substring(0, 8);
    
    let keyData;
    let userExists = false;
    let existingActivation = false;

    // Try database first
    if (mongoose.connection.readyState === 1) {
      console.log('🗄️ Using database mode');
      keyData = await Key.findOne({ key: cleanKey, isActive: true });
      if (keyData) {
        userExists = await User.exists({ hwid });
        existingActivation = await User.exists({ key: cleanKey });
      }
    } 
    // Fallback to memory
    else {
      console.log('💾 Using memory mode');
      keyData = memoryStorage.keys.get(cleanKey);
      userExists = memoryStorage.users.has(hwid);
      existingActivation = memoryStorage.activations.has(cleanKey);
    }

    if (!keyData) {
      console.log('❌ Key not found:', cleanKey);
      return res.json({ success: false, message: 'Invalid activation key' });
    }

    if (!keyData.isActive) {
      console.log('❌ Key inactive:', cleanKey);
      return res.json({ success: false, message: 'Key is not active' });
    }

    if (keyData.usesLeft <= 0) {
      console.log('❌ Key has no uses left');
      return res.json({ success: false, message: 'Key has no uses left' });
    }

    if (userExists) {
      console.log('❌ Device already activated');
      return res.json({ success: false, message: 'Device already activated' });
    }

    if (existingActivation && keyData.type !== 'coder') {
      console.log('❌ Key already used by another device');
      return res.json({ success: false, message: 'Key already used' });
    }

    // Create activation
    if (mongoose.connection.readyState === 1) {
      // Database mode
      const user = new User({
        hwid,
        nickname: cleanNickname,
        key: cleanKey,
        role: keyData.type
      });

      // Update key uses (only for non-coder keys)
      if (keyData.type !== 'coder') {
        keyData.usesLeft -= 1;
        if (keyData.usesLeft <= 0) {
          keyData.isActive = false;
        }
        await keyData.save();
      }

      await user.save();
    } else {
      // Memory mode
      memoryStorage.users.set(hwid, {
        hwid,
        nickname: cleanNickname,
        key: cleanKey,
        role: keyData.type,
        activatedAt: new Date(),
        lastSeen: new Date(),
        totalUsage: 0,
        isActive: true
      });

      // Track activation
      memoryStorage.activations.set(cleanKey, hwid);

      // Update key uses
      if (keyData.type !== 'coder') {
        keyData.usesLeft -= 1;
        if (keyData.usesLeft <= 0) {
          keyData.isActive = false;
        }
        memoryStorage.keys.set(cleanKey, keyData);
      }
    }

    console.log('✅ Activation successful for:', cleanNickname, 'role:', keyData.type);

    res.json({
      success: true,
      role: keyData.type,
      nickname: cleanNickname,
      message: 'Activation successful!',
      mode: mongoose.connection.readyState === 1 ? 'database' : 'memory'
    });

  } catch (error) {
    console.error('❌ Activation error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

// Enhanced Validation endpoint - HWID only
app.post('/api/validate', async (req, res) => {
  const { hwid } = req.body;
  
  console.log('🔐 Validation request for HWID:', hwid?.substring(0, 10) + '...');
  
  try {
    let user;
    
    if (mongoose.connection.readyState === 1) {
      user = await User.findOne({ hwid, isActive: true });
      if (user) {
        user.lastSeen = new Date();
        user.totalUsage += 1;
        await user.save();
      }
    } else {
      user = memoryStorage.users.get(hwid);
      if (user && user.isActive) {
        user.lastSeen = new Date();
        user.totalUsage += 1;
      }
    }
    
    if (user) {
      console.log('✅ Validation successful for:', user.nickname, 'role:', user.role);
      res.json({ 
        valid: true, 
        role: user.role,
        nickname: user.nickname 
      });
    } else {
      console.log('❌ Validation failed for HWID');
      res.json({ valid: false });
    }
  } catch (error) {
    console.error('❌ Validation error:', error);
    res.status(500).json({ valid: false, error: error.message });
  }
});

// Script delivery endpoint with enhanced security
app.get('/api/script', async (req, res) => {
  const hwid = req.headers['x-hwid'];
  const key = req.headers['x-key'];

  console.log('📦 Script request for HWID:', hwid?.substring(0, 10) + '...');

  try {
    let user;
    
    if (mongoose.connection.readyState === 1) {
      user = await User.findOne({ hwid, isActive: true });
    } else {
      user = memoryStorage.users.get(hwid);
      if (!user || !user.isActive) {
        user = null;
      }
    }

    if (!user) {
      console.log('❌ Access denied for HWID');
      return res.status(403).json({ error: 'Access denied - invalid HWID' });
    }

    // Enhanced script with role-based features
    const script = `
      (function() {
        'use strict';
        
        // User data from cloud
        const userData = {
          nickname: "${user.nickname}",
          role: "${user.role}",
          hwid: "${user.hwid}",
          activatedAt: "${user.activatedAt}"
        };
        
        console.log('⚡ Tamp. Cloud loaded for ' + userData.nickname + ' [' + userData.role + ']');
        
        // Enhanced protection system
        const protection = {
          init: function() {
            this.antiTamper();
            this.hwidCheck();
          },
          
          antiTamper: function() {
            const originalLog = console.log;
            console.log = function(...args) {
              if (args[0] && typeof args[0] === 'string' && args[0].includes('tamp')) {
                return; // Block tamp-related logs
              }
              originalLog.apply(console, args);
            };
          },
          
          hwidCheck: function() {
            setInterval(() => {
              // HWID validation logic here
            }, 30000);
          }
        };
        
        protection.init();
        
        // Role-based features
        const features = {
          premium: ['max_speed', 'unlimited_particles', 'premium_themes'],
          beta: ['high_speed', 'enhanced_particles', 'beta_themes'],
          friend: ['medium_speed', 'basic_particles', 'friend_themes'],
          coder: ['unlimited_all', 'developer_tools', 'all_themes'],
          trial: ['low_speed', 'no_particles', 'basic_themes']
        };
        
        // Load main Tamp system
        ${/* Здесь будет вставлен основной код Tamp.js */''}
        
      })();
    `;

    // Update usage
    if (mongoose.connection.readyState === 1) {
      user.totalUsage += 1;
      user.lastSeen = new Date();
      await user.save();
    } else {
      user.totalUsage += 1;
      user.lastSeen = new Date();
    }

    console.log('✅ Script delivered to:', user.nickname);

    res.setHeader('Content-Type', 'application/javascript');
    res.send(script);

  } catch (error) {
    console.error('❌ Script delivery error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Key management endpoint
app.get('/api/keys/status', async (req, res) => {
  try {
    let availableKeys = [];
    let usedKeys = [];
    
    if (mongoose.connection.readyState === 1) {
      const activeKeys = await Key.find({ isActive: true });
      const inactiveKeys = await Key.find({ isActive: false });
      availableKeys = activeKeys.map(k => ({
        key: k.key,
        type: k.type,
        usesLeft: k.usesLeft,
        maxUses: k.maxUses
      }));
      usedKeys = inactiveKeys.map(k => k.key);
    } else {
      availableKeys = Array.from(memoryStorage.keys.values())
        .filter(k => k.isActive)
        .map(k => ({
          key: k.key,
          type: k.type,
          usesLeft: k.usesLeft,
          maxUses: k.maxUses
        }));
      usedKeys = Array.from(memoryStorage.keys.values())
        .filter(k => !k.isActive)
        .map(k => k.key);
    }
    
    res.json({
      availableKeys,
      usedKeys,
      totalAvailable: availableKeys.length,
      totalUsed: usedKeys.length,
      mode: mongoose.connection.readyState === 1 ? 'database' : 'memory'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Tamp. Cloud Server v2.1.0 is running!',
    version: '2.1.0',
    features: [
      'HWID-based activation',
      'Role system (Premium/Beta/Friend/Coder/Trial)',
      'Key management',
      'Enhanced security',
      'Memory fallback system'
    ],
    endpoints: {
      health: '/api/health',
      activate: '/api/activate',
      validate: '/api/validate',
      script: '/api/script',
      keyStatus: '/api/keys/status'
    }
  });
});

// Initialize server
async function startServer() {
  try {
    console.log('🚀 Starting Tamp. Cloud Server v2.1.0...');
    
    // Initialize memory storage immediately
    initializeMemoryStorage();
    
    // Try to initialize database keys (non-blocking)
    setTimeout(() => {
      initializeKeys();
    }, 1000);
    
    app.listen(PORT, () => {
      console.log('=================================');
      console.log('🚀 Tamp. Cloud Server v2.1.0 Started');
      console.log('📍 Port:', PORT);
      console.log('🌐 Environment:', process.env.NODE_ENV || 'production');
      console.log('💾 Mode:', mongoose.connection.readyState === 1 ? 'DATABASE' : 'MEMORY (fallback)');
      console.log('🔑 Keys: 25 Premium, 10 Beta, 5 Friend, 1 Coder, 5 Trial');
      console.log('🔗 URL: https://tamp-cloud-server.onrender.com');
      console.log('=================================');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
