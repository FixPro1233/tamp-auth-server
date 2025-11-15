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
app.use(express.static('public')); // Для статических файлов

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

// NEW KEY SET
const NEW_KEYS = {
  'premium': Array.from({length: 25}, () => generateKey('PREMIUM')),
  'beta': Array.from({length: 10}, () => generateKey('BETA')),
  'friend': Array.from({length: 5}, () => generateKey('FRIEND')),
  'coder': ['CODER-F1X-PR0-ULTRA-2024'],
  'trial': Array.from({length: 5}, () => generateKey('TRIAL'))
};

console.log('🔑 Generated Keys:');
Object.entries(NEW_KEYS).forEach(([type, keys]) => {
  console.log(`${type.toUpperCase()}: ${keys.length} keys`);
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

// 🎨 BEAUTIFUL WEB INTERFACE - ОТДЕЛЬНЫЙ HTML ФАЙЛ
const adminHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🔑 Tamp.Cloud Key Manager</title>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        :root {
            --primary: #8A2BE2;
            --primary-dark: #4B0082;
            --secondary: #FFD700;
            --danger: #e74c3c;
            --success: #27ae60;
            --warning: #f39c12;
            --info: #3498db;
            --dark: #2c3e50;
            --light: #ecf0f1;
            --gray: #95a5a6;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #0a0a15 0%, #1a1a2e 100%);
            color: var(--light);
            min-height: 100vh;
            line-height: 1.6;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
        }

        .header {
            text-align: center;
            margin-bottom: 30px;
            padding: 20px;
            background: rgba(255,255,255,0.05);
            border-radius: 15px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(138, 43, 226, 0.3);
        }

        .header h1 {
            color: var(--secondary);
            font-size: 2.5em;
            margin-bottom: 10px;
            text-shadow: 0 0 20px rgba(255, 215, 0, 0.5);
        }

        .header p {
            color: var(--gray);
            font-size: 1.1em;
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }

        .stat-card {
            background: rgba(255,255,255,0.08);
            padding: 25px;
            border-radius: 12px;
            text-align: center;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.1);
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .stat-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 10px 25px rgba(0,0,0,0.2);
        }

        .stat-card.premium { border-top: 4px solid var(--secondary); }
        .stat-card.beta { border-top: 4px solid var(--info); }
        .stat-card.friend { border-top: 4px solid var(--success); }
        .stat-card.coder { border-top: 4px solid var(--warning); }
        .stat-card.trial { border-top: 4px solid var(--danger); }

        .stat-number {
            font-size: 2.5em;
            font-weight: bold;
            margin: 10px 0;
        }

        .stat-card.premium .stat-number { color: var(--secondary); }
        .stat-card.beta .stat-number { color: var(--info); }
        .stat-card.friend .stat-number { color: var(--success); }
        .stat-card.coder .stat-number { color: var(--warning); }
        .stat-card.trial .stat-number { color: var(--danger); }

        .controls {
            display: flex;
            gap: 15px;
            margin-bottom: 30px;
            flex-wrap: wrap;
        }

        .btn {
            padding: 12px 24px;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            gap: 8px;
            text-decoration: none;
            font-size: 14px;
        }

        .btn-primary {
            background: linear-gradient(135deg, var(--primary), var(--primary-dark));
            color: white;
        }

        .btn-success {
            background: linear-gradient(135deg, var(--success), #229954);
            color: white;
        }

        .btn-warning {
            background: linear-gradient(135deg, var(--warning), #e67e22);
            color: white;
        }

        .btn-danger {
            background: linear-gradient(135deg, var(--danger), #c0392b);
            color: white;
        }

        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
        }

        .tabs {
            display: flex;
            gap: 5px;
            margin-bottom: 20px;
            background: rgba(255,255,255,0.05);
            padding: 5px;
            border-radius: 10px;
            flex-wrap: wrap;
        }

        .tab {
            padding: 12px 24px;
            background: transparent;
            border: none;
            color: var(--gray);
            cursor: pointer;
            border-radius: 8px;
            transition: all 0.3s ease;
            font-weight: 600;
        }

        .tab.active {
            background: var(--primary);
            color: white;
        }

        .tab:hover:not(.active) {
            background: rgba(138, 43, 226, 0.2);
            color: var(--light);
        }

        .keys-container {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
        }

        @media (max-width: 1024px) {
            .keys-container {
                grid-template-columns: 1fr;
            }
        }

        .keys-section {
            background: rgba(255,255,255,0.05);
            border-radius: 12px;
            padding: 25px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.1);
        }

        .section-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 1px solid rgba(255,255,255,0.1);
        }

        .section-header h2 {
            color: var(--secondary);
            font-size: 1.5em;
        }

        .key-list {
            max-height: 500px;
            overflow-y: auto;
        }

        .key-item {
            background: rgba(255,255,255,0.08);
            padding: 15px;
            margin-bottom: 10px;
            border-radius: 8px;
            border-left: 4px solid;
            transition: all 0.3s ease;
        }

        .key-item:hover {
            background: rgba(255,255,255,0.12);
            transform: translateX(5px);
        }

        .key-item.premium { border-left-color: var(--secondary); }
        .key-item.beta { border-left-color: var(--info); }
        .key-item.friend { border-left-color: var(--success); }
        .key-item.coder { border-left-color: var(--warning); }
        .key-item.trial { border-left-color: var(--danger); }

        .key-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }

        .key-code {
            font-family: 'Courier New', monospace;
            font-weight: bold;
            font-size: 1.1em;
        }

        .key-type {
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.8em;
            font-weight: bold;
            text-transform: uppercase;
        }

        .type-premium { background: rgba(255, 215, 0, 0.2); color: var(--secondary); }
        .type-beta { background: rgba(52, 152, 219, 0.2); color: var(--info); }
        .type-friend { background: rgba(39, 174, 96, 0.2); color: var(--success); }
        .type-coder { background: rgba(243, 156, 18, 0.2); color: var(--warning); }
        .type-trial { background: rgba(231, 76, 60, 0.2); color: var(--danger); }

        .key-meta {
            display: flex;
            gap: 15px;
            font-size: 0.9em;
            color: var(--gray);
        }

        .key-status {
            display: flex;
            align-items: center;
            gap: 5px;
        }

        .status-active { color: var(--success); }
        .status-used { color: var(--danger); }

        .key-actions {
            margin-top: 10px;
            display: flex;
            gap: 8px;
        }

        .btn-small {
            padding: 6px 12px;
            font-size: 0.8em;
        }

        .copy-btn {
            background: rgba(52, 152, 219, 0.3);
            color: var(--info);
            border: 1px solid var(--info);
        }

        .users-section {
            margin-top: 30px;
        }

        .user-item {
            background: rgba(255,255,255,0.08);
            padding: 15px;
            margin-bottom: 10px;
            border-radius: 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .user-info h4 {
            color: var(--secondary);
            margin-bottom: 5px;
        }

        .user-meta {
            font-size: 0.9em;
            color: var(--gray);
        }

        .chart-container {
            background: rgba(255,255,255,0.05);
            border-radius: 12px;
            padding: 25px;
            margin-bottom: 30px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.1);
        }

        .loading {
            text-align: center;
            padding: 40px;
            color: var(--gray);
        }

        .notification {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 25px;
            border-radius: 8px;
            background: var(--success);
            color: white;
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
            transform: translateX(400px);
            transition: transform 0.3s ease;
            z-index: 1000;
        }

        .notification.show {
            transform: translateX(0);
        }

        .notification.error {
            background: var(--danger);
        }

        .search-box {
            padding: 10px 15px;
            border: 1px solid rgba(255,255,255,0.2);
            background: rgba(255,255,255,0.05);
            border-radius: 8px;
            color: white;
            width: 250px;
            margin-bottom: 20px;
        }

        .search-box::placeholder {
            color: var(--gray);
        }

        .empty-state {
            text-align: center;
            padding: 40px;
            color: var(--gray);
        }

        .empty-state i {
            font-size: 3em;
            margin-bottom: 15px;
            opacity: 0.5;
        }

        .badge {
            background: var(--primary);
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.9em;
            font-weight: bold;
        }

        .modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            z-index: 1000;
            align-items: center;
            justify-content: center;
        }

        .modal-content {
            background: #2c3e50;
            padding: 30px;
            border-radius: 15px;
            max-width: 400px;
            width: 90%;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1><i class="fas fa-key"></i> Tamp.Cloud Key Manager</h1>
            <p>Manage activation keys and user accounts</p>
        </div>

        <div class="stats-grid" id="statsGrid">
            <div class="loading">
                <i class="fas fa-spinner fa-spin"></i> Loading statistics...
            </div>
        </div>

        <div class="chart-container">
            <canvas id="keysChart" width="400" height="200"></canvas>
        </div>

        <div class="controls">
            <button class="btn btn-primary" onclick="loadAllKeys()">
                <i class="fas fa-sync-alt"></i> Refresh Data
            </button>
            <button class="btn btn-success" onclick="showGenerateModal()">
                <i class="fas fa-plus"></i> Generate Keys
            </button>
            <button class="btn btn-warning" onclick="loadUsedKeys()">
                <i class="fas fa-history"></i> Used Keys
            </button>
            <button class="btn btn-primary" onclick="loadAvailableKeys()">
                <i class="fas fa-check-circle"></i> Available Keys
            </button>
            <button class="btn btn-primary" onclick="loadUsers()">
                <i class="fas fa-users"></i> Users
            </button>
        </div>

        <div class="tabs">
            <button class="tab active" onclick="showTab('all')">All Keys</button>
            <button class="tab" onclick="showTab('premium')">Premium</button>
            <button class="tab" onclick="showTab('beta')">Beta</button>
            <button class="tab" onclick="showTab('friend')">Friend</button>
            <button class="tab" onclick="showTab('coder')">Coder</button>
            <button class="tab" onclick="showTab('trial')">Trial</button>
        </div>

        <input type="text" class="search-box" placeholder="Search keys..." onkeyup="filterKeys(this.value)">

        <div class="keys-container">
            <div class="keys-section">
                <div class="section-header">
                    <h2><i class="fas fa-key"></i> Available Keys</h2>
                    <span class="badge" id="availableCount">0</span>
                </div>
                <div class="key-list" id="availableKeys">
                    <div class="loading">
                        <i class="fas fa-spinner fa-spin"></i> Loading available keys...
                    </div>
                </div>
            </div>

            <div class="keys-section">
                <div class="section-header">
                    <h2><i class="fas fa-history"></i> Used Keys</h2>
                    <span class="badge" id="usedCount">0</span>
                </div>
                <div class="key-list" id="usedKeys">
                    <div class="loading">
                        <i class="fas fa-spinner fa-spin"></i> Loading used keys...
                    </div>
                </div>
            </div>
        </div>

        <div class="users-section" id="usersSection" style="display: none;">
            <div class="section-header">
                <h2><i class="fas fa-users"></i> Active Users</h2>
                <span class="badge" id="usersCount">0</span>
            </div>
            <div id="usersList">
                <div class="loading">
                    <i class="fas fa-spinner fa-spin"></i> Loading users...
                </div>
            </div>
        </div>
    </div>

    <div class="notification" id="notification"></div>

    <!-- Generate Keys Modal -->
    <div id="generateModal" class="modal">
        <div class="modal-content">
            <h3 style="color: var(--secondary); margin-bottom: 20px;"><i class="fas fa-plus"></i> Generate New Keys</h3>
            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 8px; color: var(--light);">Key Type:</label>
                <select id="keyType" style="width: 100%; padding: 10px; border-radius: 8px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: white;">
                    <option value="premium">Premium</option>
                    <option value="beta">Beta</option>
                    <option value="friend">Friend</option>
                    <option value="coder">Coder</option>
                    <option value="trial">Trial</option>
                </select>
            </div>
            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 8px; color: var(--light);">Number of Keys:</label>
                <input type="number" id="keyCount" value="1" min="1" max="50" style="width: 100%; padding: 10px; border-radius: 8px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: white;">
            </div>
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button class="btn btn-danger" onclick="closeGenerateModal()">Cancel</button>
                <button class="btn btn-success" onclick="generateKeys()">Generate</button>
            </div>
        </div>
    </div>

    <script>
        const ADMIN_KEY = '${ADMIN_KEY}';
        let allKeys = [];
        let currentTab = 'all';

        // Load initial data
        document.addEventListener('DOMContentLoaded', function() {
            console.log('DOM loaded, initializing...');
            loadStatistics();
            loadAllKeys();
        });

        async function fetchWithAuth(url) {
            try {
                console.log('Fetching:', url);
                const response = await fetch(url, {
                    headers: {
                        'x-admin-key': ADMIN_KEY
                    }
                });
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return await response.json();
            } catch (error) {
                console.error('Fetch error:', error);
                showNotification('Error fetching data: ' + error.message, 'error');
                throw error;
            }
        }

        async function loadStatistics() {
            try {
                console.log('Loading statistics...');
                const data = await fetchWithAuth('/api/admin/keys');
                updateStatistics(data.statistics);
                updateChart(data.statistics);
            } catch (error) {
                console.error('Error loading statistics:', error);
            }
        }

        function updateStatistics(stats) {
            const statsGrid = document.getElementById('statsGrid');
            if (!statsGrid) return;
            
            statsGrid.innerHTML = \`
                <div class="stat-card premium">
                    <i class="fas fa-crown fa-2x"></i>
                    <div class="stat-number">\${stats.byType.premium}</div>
                    <div>Premium Keys</div>
                    <small>\${stats.usedByType.premium} used</small>
                </div>
                <div class="stat-card beta">
                    <i class="fas fa-flask fa-2x"></i>
                    <div class="stat-number">\${stats.byType.beta}</div>
                    <div>Beta Keys</div>
                    <small>\${stats.usedByType.beta} used</small>
                </div>
                <div class="stat-card friend">
                    <i class="fas fa-user-friends fa-2x"></i>
                    <div class="stat-number">\${stats.byType.friend}</div>
                    <div>Friend Keys</div>
                    <small>\${stats.usedByType.friend} used</small>
                </div>
                <div class="stat-card coder">
                    <i class="fas fa-code fa-2x"></i>
                    <div class="stat-number">\${stats.byType.coder}</div>
                    <div>Coder Keys</div>
                    <small>\${stats.usedByType.coder} used</small>
                </div>
                <div class="stat-card trial">
                    <i class="fas fa-clock fa-2x"></i>
                    <div class="stat-number">\${stats.byType.trial}</div>
                    <div>Trial Keys</div>
                    <small>\${stats.usedByType.trial} used</small>
                </div>
            \`;
        }

        function updateChart(stats) {
            const ctx = document.getElementById('keysChart');
            if (!ctx) return;
            
            const existingChart = Chart.getChart(ctx);
            if (existingChart) {
                existingChart.destroy();
            }
            
            new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Available', 'Used'],
                    datasets: [{
                        data: [stats.active, stats.used],
                        backgroundColor: ['#27ae60', '#e74c3c'],
                        borderWidth: 2,
                        borderColor: '#2c3e50'
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                color: '#ecf0f1',
                                font: { size: 12 }
                            }
                        },
                        title: {
                            display: true,
                            text: 'Key Usage Distribution',
                            color: '#ecf0f1',
                            font: { size: 16 }
                        }
                    }
                }
            });
        }

        async function loadAllKeys() {
            try {
                console.log('Loading all keys...');
                const data = await fetchWithAuth('/api/admin/keys');
                allKeys = data.keys;
                renderKeys();
                showNotification('Data refreshed successfully');
            } catch (error) {
                console.error('Error loading keys:', error);
            }
        }

        async function loadAvailableKeys() {
            try {
                console.log('Loading available keys...');
                const data = await fetchWithAuth('/api/admin/keys/available');
                renderAvailableKeys(data.availableKeys);
                showNotification('Available keys loaded');
            } catch (error) {
                console.error('Error loading available keys:', error);
            }
        }

        async function loadUsedKeys() {
            try {
                console.log('Loading used keys...');
                const data = await fetchWithAuth('/api/admin/keys/used');
                renderUsedKeys(data.usedKeys);
                showNotification('Used keys loaded');
            } catch (error) {
                console.error('Error loading used keys:', error);
            }
        }

        async function loadUsers() {
            try {
                console.log('Loading users...');
                const data = await fetchWithAuth('/api/admin/users');
                renderUsers(data.users);
                document.getElementById('usersSection').style.display = 'block';
                showNotification('Users loaded');
            } catch (error) {
                console.error('Error loading users:', error);
            }
        }

        function renderKeys() {
            renderAvailableKeys(allKeys);
            renderUsedKeys(allKeys);
        }

        function renderAvailableKeys(keysData) {
            const container = document.getElementById('availableKeys');
            if (!container) return;
            
            let availableKeys = [];
            Object.values(keysData).forEach(keys => {
                keys.filter(k => k.isActive).forEach(k => availableKeys.push(k));
            });

            document.getElementById('availableCount').textContent = availableKeys.length;

            if (availableKeys.length === 0) {
                container.innerHTML = \`
                    <div class="empty-state">
                        <i class="fas fa-key"></i>
                        <p>No available keys</p>
                    </div>
                \`;
                return;
            }

            container.innerHTML = availableKeys.map(key => \`
                <div class="key-item \${key.type}">
                    <div class="key-header">
                        <div class="key-code">\${key.key}</div>
                        <span class="key-type type-\${key.type}">\${key.type}</span>
                    </div>
                    <div class="key-meta">
                        <div class="key-status status-active">
                            <i class="fas fa-check-circle"></i> Available
                        </div>
                    </div>
                    <div class="key-actions">
                        <button class="btn btn-small copy-btn" onclick="copyKey('\${key.key}')">
                            <i class="fas fa-copy"></i> Copy
                        </button>
                    </div>
                </div>
            \`).join('');
        }

        function renderUsedKeys(keysData) {
            const container = document.getElementById('usedKeys');
            if (!container) return;
            
            let usedKeys = [];
            Object.values(keysData).forEach(keys => {
                keys.filter(k => !k.isActive).forEach(k => usedKeys.push(k));
            });

            document.getElementById('usedCount').textContent = usedKeys.length;

            if (usedKeys.length === 0) {
                container.innerHTML = \`
                    <div class="empty-state">
                        <i class="fas fa-history"></i>
                        <p>No used keys</p>
                    </div>
                \`;
                return;
            }

            container.innerHTML = usedKeys.map(key => \`
                <div class="key-item \${key.type}">
                    <div class="key-header">
                        <div class="key-code">\${key.key}</div>
                        <span class="key-type type-\${key.type}">\${key.type}</span>
                    </div>
                    <div class="key-meta">
                        <div class="key-status status-used">
                            <i class="fas fa-times-circle"></i> Used
                        </div>
                        \${key.usedBy ? \`<div><i class="fas fa-user"></i> \${key.usedBy}</div>\` : ''}
                        \${key.activatedAt ? \`<div><i class="fas fa-calendar"></i> \${new Date(key.activatedAt).toLocaleDateString()}</div>\` : ''}
                    </div>
                    <div class="key-actions">
                        <button class="btn btn-small copy-btn" onclick="copyKey('\${key.key}')">
                            <i class="fas fa-copy"></i> Copy
                        </button>
                        <button class="btn btn-small btn-warning" onclick="resetKey('\${key.key}')">
                            <i class="fas fa-redo"></i> Reset
                        </button>
                    </div>
                </div>
            \`).join('');
        }

        function renderUsers(users) {
            const container = document.getElementById('usersList');
            const section = document.getElementById('usersSection');
            if (!container || !section) return;
            
            section.style.display = 'block';
            document.getElementById('usersCount').textContent = users.length;

            if (users.length === 0) {
                container.innerHTML = \`
                    <div class="empty-state">
                        <i class="fas fa-users"></i>
                        <p>No active users</p>
                    </div>
                \`;
                return;
            }

            container.innerHTML = users.map(user => \`
                <div class="user-item">
                    <div class="user-info">
                        <h4>\${user.nickname}</h4>
                        <div class="user-meta">
                            <span class="key-type type-\${user.role}">\${user.role}</span>
                            <span>• HWID: \${user.hwid?.substring(0, 10)}...</span>
                            <span>• Activated: \${new Date(user.activatedAt).toLocaleDateString()}</span>
                            <span>• Usage: \${user.totalUsage} times</span>
                        </div>
                    </div>
                    <div class="key-actions">
                        <button class="btn btn-small btn-danger" onclick="deactivateUser('\${user.hwid}')">
                            <i class="fas fa-ban"></i> Deactivate
                        </button>
                    </div>
                </div>
            \`).join('');
        }

        function showTab(tab) {
            console.log('Showing tab:', tab);
            currentTab = tab;
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            event.target.classList.add('active');
            filterKeys(document.querySelector('.search-box').value);
        }

        function filterKeys(searchTerm) {
            console.log('Filtering keys with:', searchTerm);
            const items = document.querySelectorAll('.key-item');
            items.forEach(item => {
                const keyText = item.querySelector('.key-code').textContent.toLowerCase();
                const keyType = item.classList[1];
                
                const matchesSearch = !searchTerm || keyText.includes(searchTerm.toLowerCase());
                const matchesTab = currentTab === 'all' || keyType === currentTab;
                
                item.style.display = matchesSearch && matchesTab ? 'block' : 'none';
            });
        }

        function copyKey(key) {
            console.log('Copying key:', key);
            navigator.clipboard.writeText(key).then(() => {
                showNotification('Key copied to clipboard: ' + key);
            }).catch(err => {
                console.error('Copy failed:', err);
                showNotification('Copy failed', 'error');
            });
        }

        async function resetKey(key) {
            if (!confirm('Are you sure you want to reset this key? It will become available for activation again.')) {
                return;
            }

            try {
                console.log('Resetting key:', key);
                const response = await fetch('/api/admin/keys/reset', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-admin-key': ADMIN_KEY
                    },
                    body: JSON.stringify({ key: key })
                });

                const data = await response.json();
                
                if (data.success) {
                    showNotification('Key reset successfully');
                    loadAllKeys();
                    loadStatistics();
                } else {
                    showNotification('Error resetting key: ' + data.message, 'error');
                }
            } catch (error) {
                console.error('Error resetting key:', error);
                showNotification('Error resetting key', 'error');
            }
        }

        function deactivateUser(hwid) {
            if (!confirm('Are you sure you want to deactivate this user?')) {
                return;
            }
            showNotification('User deactivation feature coming soon...', 'error');
        }

        function showGenerateModal() {
            console.log('Showing generate modal');
            document.getElementById('generateModal').style.display = 'flex';
        }

        function closeGenerateModal() {
            console.log('Closing generate modal');
            document.getElementById('generateModal').style.display = 'none';
        }

        async function generateKeys() {
            const type = document.getElementById('keyType').value;
            const count = parseInt(document.getElementById('keyCount').value);

            try {
                console.log('Generating keys:', type, count);
                const response = await fetch('/api/admin/keys/generate', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-admin-key': ADMIN_KEY
                    },
                    body: JSON.stringify({ type, count })
                });

                const data = await response.json();
                
                if (data.success) {
                    showNotification(\`Generated \${data.generated} \${type} keys\`);
                    closeGenerateModal();
                    loadAllKeys();
                    loadStatistics();
                } else {
                    showNotification('Error generating keys: ' + data.error, 'error');
                }
            } catch (error) {
                console.error('Error generating keys:', error);
                showNotification('Error generating keys', 'error');
            }
        }

        function showNotification(message, type = 'success') {
            console.log('Showing notification:', message, type);
            const notification = document.getElementById('notification');
            if (!notification) return;
            
            notification.textContent = message;
            notification.className = 'notification ' + (type === 'error' ? 'error' : '') + ' show';
            
            setTimeout(() => {
                notification.classList.remove('show');
            }, 3000);
        }

        // Global error handler
        window.addEventListener('error', function(e) {
            console.error('Global error:', e.error);
            showNotification('JavaScript error occurred, check console', 'error');
        });
    </script>
</body>
</html>
`;

// 🎨 WEB INTERFACE ENDPOINT
app.get('/admin', (req, res) => {
  const adminKey = req.query.admin_key;
  
  if (!adminKey || adminKey !== ADMIN_KEY) {
    return res.status(403).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Access Denied</title>
        <style>
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            margin: 0; padding: 0; height: 100vh;
            display: flex; align-items: center; justify-content: center;
          }
          .container { 
            background: rgba(255,255,255,0.95); 
            padding: 40px; 
            border-radius: 15px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 400px;
          }
          h1 { color: #e74c3c; margin-bottom: 20px; }
          .btn { 
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white; padding: 12px 30px;
            border: none; border-radius: 25px;
            text-decoration: none; display: inline-block;
            margin-top: 20px; font-weight: bold;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🔐 Access Denied</h1>
          <p>Invalid or missing admin key</p>
          <a href="/admin?admin_key=FIXPRO_ADMIN_2024" class="btn">Try Again</a>
        </div>
      </body>
      </html>
    `);
  }

  res.send(adminHTML.replace(/\${ADMIN_KEY}/g, ADMIN_KEY));
});

// 📊 HEALTH CHECK ENDPOINT
app.get('/api/health', async (req, res) => {
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
      features: ['HWID Activation', 'Auto Key Invalidation', 'Role System', 'Admin API', 'Web Interface']
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
      keyInvalidated: keyData.type !== 'coder'
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

    const script = `
      (function() {
        'use strict';
        
        const userData = {
          nickname: "${user.nickname}",
          role: "${user.role}",
          hwid: "${user.hwid}",
          activatedAt: "${user.activatedAt}"
        };
        
        console.log('⚡ Tamp. Cloud loaded for ' + userData.nickname + ' [' + userData.role + ']');
        
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

// 🔐 ADMIN API ENDPOINTS

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
      'Beautiful web interface for key management',
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
        webInterface: '/admin?admin_key=FIXPRO_ADMIN_2024',
        keys: '/api/admin/keys',
        availableKeys: '/api/admin/keys/available',
        usedKeys: '/api/admin/keys/used',
        users: '/api/admin/users',
        generateKeys: '/api/admin/keys/generate',
        resetKey: '/api/admin/keys/reset'
      }
    },
    adminAccess: 'Use header: x-admin-key: FIXPRO_ADMIN_2024 or visit /admin?admin_key=FIXPRO_ADMIN_2024'
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
      console.log('🎨 Web Interface: /admin?admin_key=FIXPRO_ADMIN_2024');
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
