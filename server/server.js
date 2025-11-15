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

// MongoDB connection with better error handling
console.log('🔧 Starting server initialization...');
console.log('📊 MongoDB URI:', MONGODB_URI ? '✅ Set' : '❌ Missing');

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

// Pre-defined keys
const PREDEFINED_KEYS = {
  'premium': [
    'PREMIUM-7X9F-2K4L-8M3N-QWER', 
    'PREMIUM-5T8R-1W6Q-9P2O-ASDF'
  ],
  'beta': [
    'BETA-7X2K-4L8M-3N9P-ZXCV', 
    'BETA-5T1W-6Q9P-2O3I-UJMN'
  ],
  'coder': [
    'CODER-F1X-PR0-ULTRA-2024'
  ],
  'friend': [
    'FRIEND-SP3C1AL-4CC3SS-TEST'
  ],
  'trial': [
    'TRIAL-7D4Y5-FREE-6H9K2'
  ]
};

// Initialize keys in database
async function initializeKeys() {
  try {
    console.log('🔑 Initializing keys...');
    
    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      console.log('⏳ Waiting for MongoDB connection...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    if (mongoose.connection.readyState !== 1) {
      console.log('❌ MongoDB not connected, skipping key initialization');
      return;
    }

    let initializedCount = 0;
    for (const [role, keys] of Object.entries(PREDEFINED_KEYS)) {
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
  keys: new Map()
};

// Initialize memory storage
function initializeMemoryStorage() {
  console.log('💾 Initializing memory storage...');
  for (const [role, keys] of Object.entries(PREDEFINED_KEYS)) {
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
      service: 'Tamp. Cloud Server',
      version: '2.0.0',
      database: dbStatus,
      memoryUsers: memoryStorage.users.size,
      memoryKeys: memoryStorage.keys.size,
      server: 'Render'
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// Simple test endpoint
app.get('/api/test', (req, res) => {
  res.json({
    message: 'Server is working!',
    timestamp: new Date().toISOString(),
    keys: Object.keys(PREDEFINED_KEYS)
  });
});

// Activation endpoint
app.post('/api/activate', async (req, res) => {
  const { nickname, key } = req.body;
  const hwid = req.headers['x-hwid'];

  console.log('🔑 Activation attempt:', { nickname, key: key?.toUpperCase(), hwid });

  if (!nickname || !key || !hwid) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  try {
    const cleanKey = key.toUpperCase().trim();
    
    let keyData;
    let userExists = false;

    // Try database first
    if (mongoose.connection.readyState === 1) {
      console.log('🗄️ Using database mode');
      keyData = await Key.findOne({ key: cleanKey, isActive: true });
      if (keyData) {
        userExists = await User.exists({ hwid });
      }
    } 
    // Fallback to memory
    else {
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

    // Create activation
    if (mongoose.connection.readyState === 1) {
      // Database mode
      const user = new User({
        hwid,
        nickname,
        key: cleanKey,
        role: keyData.type
      });

      // Update key uses
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
        nickname,
        key: cleanKey,
        role: keyData.type,
        activatedAt: new Date(),
        lastSeen: new Date(),
        totalUsage: 0,
        isActive: true
      });

      // Update key uses
      if (keyData.type !== 'coder') {
        keyData.usesLeft -= 1;
        if (keyData.usesLeft <= 0) {
          keyData.isActive = false;
        }
        memoryStorage.keys.set(cleanKey, keyData);
      }
    }

    console.log('✅ Activation successful for:', nickname, 'role:', keyData.type);

    res.json({
      success: true,
      role: keyData.type,
      message: 'Activation successful!',
      mode: mongoose.connection.readyState === 1 ? 'database' : 'memory'
    });

  } catch (error) {
    console.error('❌ Activation error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

// Validation endpoint
app.post('/api/validate', async (req, res) => {
  const { hwid, key } = req.body;
  
  try {
    let user;
    
    if (mongoose.connection.readyState === 1) {
      user = await User.findOne({ hwid, key: key.toUpperCase(), isActive: true });
      if (user) {
        user.lastSeen = new Date();
        user.totalUsage += 1;
        await user.save();
      }
    } else {
      user = memoryStorage.users.get(hwid);
      if (user && user.key === key.toUpperCase() && user.isActive) {
        user.lastSeen = new Date();
        user.totalUsage += 1;
      }
    }
    
    if (user) {
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
    let user;
    
    if (mongoose.connection.readyState === 1) {
      user = await User.findOne({ hwid, key: key.toUpperCase(), isActive: true });
    } else {
      user = memoryStorage.users.get(hwid);
      if (!user || user.key !== key.toUpperCase() || !user.isActive) {
        user = null;
      }
    }

    if (!user) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const script = `
      (function() {
        console.log('⚡ Tamp. Cloud loaded for ${user.nickname} [${user.role}]');
        alert('Tamp. Cloud успешно загружен! Добро пожаловать, ${user.nickname}!');
        
        // Add your game features here
        const style = document.createElement('style');
        style.textContent = \`
          .tamp-indicator {
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(138, 43, 226, 0.9);
            color: white;
            padding: 5px 10px;
            border-radius: 5px;
            font-size: 12px;
            z-index: 10000;
            border: 1px solid #FFD700;
          }
        \`;
        document.head.appendChild(style);
        
        const indicator = document.createElement('div');
        indicator.className = 'tamp-indicator';
        indicator.textContent = 'TAMP. ${user.role} - ${user.nickname}';
        document.body.appendChild(indicator);
        
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

    res.setHeader('Content-Type', 'application/javascript');
    res.send(script);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test keys endpoint
app.get('/api/test/keys', async (req, res) => {
  try {
    let availableKeys = [];
    
    if (mongoose.connection.readyState === 1) {
      const keys = await Key.find({ isActive: true });
      availableKeys = keys.map(k => ({
        key: k.key,
        type: k.type,
        usesLeft: k.usesLeft,
        maxUses: k.maxUses
      }));
    } else {
      availableKeys = Array.from(memoryStorage.keys.values())
        .filter(k => k.isActive)
        .map(k => ({
          key: k.key,
          type: k.type,
          usesLeft: k.usesLeft,
          maxUses: k.maxUses
        }));
    }
    
    res.json({
      availableKeys,
      predefinedKeys: PREDEFINED_KEYS,
      mode: mongoose.connection.readyState === 1 ? 'database' : 'memory'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Tamp. Cloud Server is running!',
    endpoints: {
      health: '/api/health',
      test: '/api/test',
      activate: '/api/activate',
      validate: '/api/validate',
      script: '/api/script',
      testKeys: '/api/test/keys'
    },
    version: '2.0.0'
  });
});

// Initialize server
async function startServer() {
  try {
    console.log('🚀 Starting Tamp. Cloud Server...');
    
    // Initialize memory storage immediately
    initializeMemoryStorage();
    
    // Try to initialize database keys (non-blocking)
    setTimeout(() => {
      initializeKeys();
    }, 1000);
    
    app.listen(PORT, () => {
      console.log('=================================');
      console.log('🚀 Tamp. Cloud Server Started');
      console.log('📍 Port:', PORT);
      console.log('🌐 Environment:', process.env.NODE_ENV || 'production');
      console.log('💾 Mode:', mongoose.connection.readyState === 1 ? 'DATABASE' : 'MEMORY (fallback)');
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
