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
const ADMIN_KEY = process.env.ADMIN_KEY || 'FIXPRO_ADMIN_2024';

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
  isActive: { type: Boolean, default: true },
  usedBy: { type: String, default: null },
  usedAt: { type: Date, default: null }
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

// NEW KEY SET - ТОЧНО ПО ТРЕБОВАНИЯМ
const NEW_KEYS = {
  'premium': Array.from({length: 25}, () => generateKey('PREMIUM')),
  'beta': Array.from({length: 10}, () => generateKey('BETA')),
  'friend': Array.from({length: 5}, () => generateKey('FRIEND')),
  'coder': ['CODER-F1X-PR0-ULTRA-2024'], // Всего 1 ключ для кодера
  'trial': Array.from({length: 5}, () => generateKey('TRIAL'))
};

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
              usesLeft: role === 'coder' ? 999 : 1, // Кодер ключ многоразовый
              maxUses: role === 'coder' ? 999 : 1
            });
            console.log(`✅ Added ${role} key: ${key}`);
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
  activations: new Map()
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
        isActive: true,
        usedBy: null,
        usedAt: null
      });
    }
  }
  console.log(`✅ Memory storage initialized with ${memoryStorage.keys.size} keys`);
}

// 🔐 ADMIN MIDDLEWARE
function requireAdmin(req, res, next) {
  const adminKey = req.headers['x-admin-key'] || req.query.admin_key;
  
  if (!adminKey || adminKey !== ADMIN_KEY) {
    return res.status(403).json({ 
      success: false, 
      message: 'Admin access denied' 
    });
  }
  next();
}

// 📊 HEALTH CHECK ENDPOINT
app.get('/api/health', async (req, res) => {
  try {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    
    // Count statistics
    let userCount, activeKeyCount, usedKeyCount;
    
    if (mongoose.connection.readyState === 1) {
      userCount = await User.countDocuments();
      activeKeyCount = await Key.countDocuments({ isActive: true });
      usedKeyCount = await Key.countDocuments({ isActive: false });
    } else {
      userCount = memoryStorage.users.size;
      activeKeyCount = Array.from(memoryStorage.keys.values()).filter(k => k.isActive).length;
      usedKeyCount = Array.from(memoryStorage.keys.values()).filter(k => !k.isActive).length;
    }
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'Tamp. Cloud Server v2.2.0',
      version: '2.2.0',
      database: dbStatus,
      statistics: {
        totalUsers: userCount,
        activeKeys: activeKeyCount,
        usedKeys: usedKeyCount,
        memoryUsers: memoryStorage.users.size,
        memoryKeys: memoryStorage.keys.size
      },
      features: ['HWID Activation', 'Auto Key Invalidation', 'Role System', 'Admin API']
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// 🔑 ACTIVATION ENDPOINT WITH AUTO INVALIDATION
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

  if (nickname.length > 8) {
    return res.status(400).json({ success: false, message: 'Nickname must be 8 characters or less' });
  }

  try {
    const cleanKey = key.toUpperCase().trim();
    const cleanNickname = nickname.substring(0, 8);
    
    let keyData;
    let userExists = false;

    // Try database first
    if (mongoose.connection.readyState === 1) {
      console.log('🗄️ Using database mode');
      keyData = await Key.findOne({ key: cleanKey });
      if (keyData) {
        userExists = await User.exists({ hwid });
      }
    } else {
      console.log('💾 Using memory mode');
      keyData = memoryStorage.keys.get(cleanKey);
      userExists = memoryStorage.users.has(hwid);
    }

    if (!keyData) {
      console.log('❌ Key not found:', cleanKey);
      return res.json({ success: false, message: 'Invalid activation key' });
    }

    if (!keyData.isActive) {
      console.log('❌ Key inactive:', cleanKey);
      return res.json({ success: false, message: 'Key has already been used' });
    }

    if (userExists) {
      console.log('❌ Device already activated');
      return res.json({ success: false, message: 'Device already activated' });
    }

    // 🚨 KEY INVALIDATION LOGIC - Все ключи кроме кодера становятся невалидными
    if (keyData.type !== 'coder') {
      if (mongoose.connection.readyState === 1) {
        // Database mode - инвалидируем ключ
        keyData.isActive = false;
        keyData.usesLeft = 0;
        keyData.usedBy = cleanNickname;
        keyData.usedAt = new Date();
        await keyData.save();
      } else {
        // Memory mode - инвалидируем ключ
        keyData.isActive = false;
        keyData.usesLeft = 0;
        keyData.usedBy = cleanNickname;
        keyData.usedAt = new Date();
        memoryStorage.keys.set(cleanKey, keyData);
      }
      console.log('🔒 Key invalidated after activation:', cleanKey);
    }

    // Create user activation
    if (mongoose.connection.readyState === 1) {
      const user = new User({
        hwid,
        nickname: cleanNickname,
        key: cleanKey,
        role: keyData.type
      });
      await user.save();
    } else {
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
    }

    console.log('✅ Activation successful for:', cleanNickname, 'role:', keyData.type);

    res.json({
      success: true,
      role: keyData.type,
      nickname: cleanNickname,
      message: 'Activation successful!',
      keyInvalidated: keyData.type !== 'coder' // Сообщаем, что ключ инвалидирован
    });

  } catch (error) {
    console.error('❌ Activation error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

// 🔐 VALIDATION ENDPOINT - HWID ONLY
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

// 📦 SCRIPT DELIVERY ENDPOINT
app.get('/api/script', async (req, res) => {
  const hwid = req.headers['x-hwid'];

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
        
        console.log('⚡ Tamp. Cloud loaded for ' + userData.nickname + ' [' + userRole + ']');
        
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
                return;
              }
              originalLog.apply(console, args);
            };
          },
          
          hwidCheck: function() {
            // HWID validation will be handled by main script
          }
        };
        
        protection.init();
        
        // Load main Tamp system
        // This will be replaced with the actual Tamp.js content
        window.tampUserData = ${JSON.stringify(userData)};
        
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

// 🔐 ADMIN ENDPOINTS

// Get all keys with status
app.get('/api/admin/keys', requireAdmin, async (req, res) => {
  try {
    let allKeys = [];
    
    if (mongoose.connection.readyState === 1) {
      const keys = await Key.find().sort({ type: 1, key: 1 });
      const users = await User.find();
      
      allKeys = keys.map(k => {
        const user = users.find(u => u.key === k.key);
        return {
          key: k.key,
          type: k.type,
          usesLeft: k.usesLeft,
          maxUses: k.maxUses,
          isActive: k.isActive,
          usedBy: user ? user.nickname : k.usedBy,
          usedByHWID: user ? user.hwid : null,
          activatedAt: user ? user.activatedAt : k.usedAt,
          createdAt: k.createdAt
        };
      });
    } else {
      allKeys = Array.from(memoryStorage.keys.values()).map(k => {
        const user = Array.from(memoryStorage.users.values()).find(u => u.key === k.key);
        return {
          key: k.key,
          type: k.type,
          usesLeft: k.usesLeft,
          maxUses: k.maxUses,
          isActive: k.isActive,
          usedBy: user ? user.nickname : k.usedBy,
          usedByHWID: user ? user.hwid : null,
          activatedAt: user ? user.activatedAt : k.usedAt,
          createdAt: k.createdAt
        };
      });
      allKeys.sort((a, b) => a.type.localeCompare(b.type) || a.key.localeCompare(b.key));
    }
    
    // Group by type
    const groupedKeys = {
      premium: allKeys.filter(k => k.type === 'premium'),
      beta: allKeys.filter(k => k.type === 'beta'),
      friend: allKeys.filter(k => k.type === 'friend'),
      coder: allKeys.filter(k => k.type === 'coder'),
      trial: allKeys.filter(k => k.type === 'trial')
    };
    
    // Statistics
    const stats = {
      total: allKeys.length,
      active: allKeys.filter(k => k.isActive).length,
      used: allKeys.filter(k => !k.isActive).length,
      byType: {
        premium: groupedKeys.premium.length,
        beta: groupedKeys.beta.length,
        friend: groupedKeys.friend.length,
        coder: groupedKeys.coder.length,
        trial: groupedKeys.trial.length
      },
      usedByType: {
        premium: groupedKeys.premium.filter(k => !k.isActive).length,
        beta: groupedKeys.beta.filter(k => !k.isActive).length,
        friend: groupedKeys.friend.filter(k => !k.isActive).length,
        coder: groupedKeys.coder.filter(k => !k.isActive).length,
        trial: groupedKeys.trial.filter(k => !k.isActive).length
      }
    };

    res.json({
      success: true,
      statistics: stats,
      keys: groupedKeys,
      mode: mongoose.connection.readyState === 1 ? 'database' : 'memory'
    });
    
  } catch (error) {
    console.error('❌ Admin keys error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get available (unused) keys
app.get('/api/admin/keys/available', requireAdmin, async (req, res) => {
  try {
    let availableKeys = [];
    
    if (mongoose.connection.readyState === 1) {
      availableKeys = await Key.find({ isActive: true }).sort({ type: 1, key: 1 });
    } else {
      availableKeys = Array.from(memoryStorage.keys.values())
        .filter(k => k.isActive)
        .sort((a, b) => a.type.localeCompare(b.type) || a.key.localeCompare(b.key));
    }
    
    // Group by type
    const groupedKeys = {
      premium: availableKeys.filter(k => k.type === 'premium'),
      beta: availableKeys.filter(k => k.type === 'beta'),
      friend: availableKeys.filter(k => k.type === 'friend'),
      coder: availableKeys.filter(k => k.type === 'coder'),
      trial: availableKeys.filter(k => k.type === 'trial')
    };

    res.json({
      success: true,
      availableKeys: groupedKeys,
      totalAvailable: availableKeys.length
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get used keys
app.get('/api/admin/keys/used', requireAdmin, async (req, res) => {
  try {
    let usedKeys = [];
    
    if (mongoose.connection.readyState === 1) {
      usedKeys = await Key.find({ isActive: false }).sort({ type: 1, key: 1 });
    } else {
      usedKeys = Array.from(memoryStorage.keys.values())
        .filter(k => !k.isActive)
        .sort((a, b) => a.type.localeCompare(b.type) || a.key.localeCompare(b.key));
    }
    
    // Group by type
    const groupedKeys = {
      premium: usedKeys.filter(k => k.type === 'premium'),
      beta: usedKeys.filter(k => k.type === 'beta'),
      friend: usedKeys.filter(k => k.type === 'friend'),
      coder: usedKeys.filter(k => k.type === 'coder'),
      trial: usedKeys.filter(k => k.type === 'trial')
    };

    res.json({
      success: true,
      usedKeys: groupedKeys,
      totalUsed: usedKeys.length
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all users
app.get('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    let users = [];
    
    if (mongoose.connection.readyState === 1) {
      users = await User.find().sort({ activatedAt: -1 });
    } else {
      users = Array.from(memoryStorage.users.values())
        .sort((a, b) => new Date(b.activatedAt) - new Date(a.activatedAt));
    }

    res.json({
      success: true,
      users: users,
      totalUsers: users.length
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Generate new keys
app.post('/api/admin/keys/generate', requireAdmin, async (req, res) => {
  try {
    const { type, count = 1 } = req.body;
    
    if (!type || !['premium', 'beta', 'friend', 'coder', 'trial'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid key type' });
    }

    const newKeys = Array.from({length: count}, () => generateKey(type.toUpperCase()));
    const results = [];

    for (const key of newKeys) {
      try {
        if (mongoose.connection.readyState === 1) {
          const existing = await Key.findOne({ key });
          if (!existing) {
            const newKey = new Key({
              key,
              type,
              usesLeft: type === 'coder' ? 999 : 1,
              maxUses: type === 'coder' ? 999 : 1
            });
            await newKey.save();
            results.push({ key, status: 'created' });
          } else {
            results.push({ key, status: 'exists' });
          }
        } else {
          if (!memoryStorage.keys.has(key)) {
            memoryStorage.keys.set(key, {
              key,
              type,
              usesLeft: type === 'coder' ? 999 : 1,
              maxUses: type === 'coder' ? 999 : 1,
              isActive: true,
              usedBy: null,
              usedAt: null
            });
            results.push({ key, status: 'created' });
          } else {
            results.push({ key, status: 'exists' });
          }
        }
      } catch (error) {
        results.push({ key, status: 'error', error: error.message });
      }
    }

    res.json({
      success: true,
      generated: count,
      results: results
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reset key (make it active again)
app.post('/api/admin/keys/reset', requireAdmin, async (req, res) => {
  try {
    const { key } = req.body;
    
    if (!key) {
      return res.status(400).json({ success: false, message: 'Key is required' });
    }

    const cleanKey = key.toUpperCase().trim();
    let result;

    if (mongoose.connection.readyState === 1) {
      const keyDoc = await Key.findOne({ key: cleanKey });
      if (keyDoc) {
        keyDoc.isActive = true;
        keyDoc.usesLeft = keyDoc.type === 'coder' ? 999 : 1;
        keyDoc.usedBy = null;
        keyDoc.usedAt = null;
        await keyDoc.save();
        result = { key: cleanKey, status: 'reset' };
      } else {
        return res.status(404).json({ success: false, message: 'Key not found' });
      }
    } else {
      const keyData = memoryStorage.keys.get(cleanKey);
      if (keyData) {
        keyData.isActive = true;
        keyData.usesLeft = keyData.type === 'coder' ? 999 : 1;
        keyData.usedBy = null;
        keyData.usedAt = null;
        memoryStorage.keys.set(cleanKey, keyData);
        result = { key: cleanKey, status: 'reset' };
      } else {
        return res.status(404).json({ success: false, message: 'Key not found' });
      }
    }

    res.json({
      success: true,
      result: result
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 📋 SERVER STATUS ENDPOINT
app.get('/api/status', async (req, res) => {
  try {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    
    let userCount, activeKeyCount, usedKeyCount;
    
    if (mongoose.connection.readyState === 1) {
      userCount = await User.countDocuments();
      activeKeyCount = await Key.countDocuments({ isActive: true });
      usedKeyCount = await Key.countDocuments({ isActive: false });
    } else {
      userCount = memoryStorage.users.size;
      activeKeyCount = Array.from(memoryStorage.keys.values()).filter(k => k.isActive).length;
      usedKeyCount = Array.from(memoryStorage.keys.values()).filter(k => !k.isActive).length;
    }

    res.json({
      status: 'online',
      server: 'Tamp. Cloud Server v2.2.0',
      timestamp: new Date().toISOString(),
      database: dbStatus,
      statistics: {
        totalUsers: userCount,
        activeKeys: activeKeyCount,
        usedKeys: usedKeyCount
      },
      keyDistribution: {
        premium: NEW_KEYS.premium.length,
        beta: NEW_KEYS.beta.length,
        friend: NEW_KEYS.friend.length,
        coder: NEW_KEYS.coder.length,
        trial: NEW_KEYS.trial.length
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🏠 ROOT ENDPOINT
app.get('/', (req, res) => {
  res.json({
    message: '🚀 Tamp. Cloud Server v2.2.0 is running!',
    version: '2.2.0',
    features: [
      'HWID-based activation system',
      'Automatic key invalidation (except coder)',
      'Role-based access (Premium/Beta/Friend/Coder/Trial)',
      'Admin API for key management',
      'Memory fallback system',
      'Enhanced security protection'
    ],
    keySystem: {
      totalKeys: 46,
      distribution: {
        premium: 25,
        beta: 10, 
        friend: 5,
        coder: 1,
        trial: 5
      },
      autoInvalidation: 'All keys except CODER become invalid after activation'
    },
    endpoints: {
      health: '/api/health',
      status: '/api/status',
      activate: '/api/activate',
      validate: '/api/validate',
      script: '/api/script',
      admin: {
        keys: '/api/admin/keys',
        availableKeys: '/api/admin/keys/available',
        usedKeys: '/api/admin/keys/used',
        users: '/api/admin/users',
        generateKeys: '/api/admin/keys/generate',
        resetKey: '/api/admin/keys/reset'
      }
    },
    adminAccess: 'Use header: x-admin-key: FIXPRO_ADMIN_2024'
  });
});

// 🚀 INITIALIZE SERVER
async function startServer() {
  try {
    console.log('🚀 Starting Tamp. Cloud Server v2.2.0...');
    
    // Initialize memory storage immediately
    initializeMemoryStorage();
    
    // Try to initialize database keys (non-blocking)
    setTimeout(() => {
      initializeKeys();
    }, 1000);
    
    app.listen(PORT, () => {
      console.log('=================================');
      console.log('🚀 Tamp. Cloud Server v2.2.0 Started');
      console.log('📍 Port:', PORT);
      console.log('🌐 Environment:', process.env.NODE_ENV || 'production');
      console.log('💾 Mode:', mongoose.connection.readyState === 1 ? 'DATABASE' : 'MEMORY (fallback)');
      console.log('🔑 Key Distribution:');
      console.log('   • 25 Premium keys');
      console.log('   • 10 Beta keys');
      console.log('   • 5 Friend keys'); 
      console.log('   • 1 Coder key');
      console.log('   • 5 Trial keys');
      console.log('🔒 Auto-invalidation: All keys except CODER');
      console.log('👑 Admin Key:', ADMIN_KEY);
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
