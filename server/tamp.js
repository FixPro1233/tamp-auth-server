// ==UserScript==
// @name         Tamp. by FixPro v5.2.5
// @namespace    http://tampermonkey.net/
// @version      5.2.5
// @description  Enhanced Tamp. with Cloud Activation
// @author       FixPro
// @match        https://dynast.io/
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      tamp-cloud-server.onrender.com
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // ==========================================================
    //                 🔐 CLOUD ACTIVATION SYSTEM
    // ==========================================================
    const API_BASE = 'https://tamp-cloud-server.onrender.com/api';
    let userData = GM_getValue('tamp_user_data', null);
    let isAuthorized = false;
    let userRole = 'UNKNOWN';
    let userNickname = 'Guest';

    // ==========================================================
    //                 🎨 ENHANCED THEME SYSTEM
    // ==========================================================
    const themes = {
        'premium': {
            name: 'Premium Purple',
            primary: '#FFD700',
            secondary: '#D4AF37',
            accent: '#FFA500',
            background: 'rgba(10, 10, 20, 0.98)',
            text: '#ffffff',
            gradient: 'linear-gradient(135deg, #FFD700, #D4AF37)',
            shadow: '0 0 30px rgba(255, 215, 0, 0.4)',
            watermarkBg: 'rgba(10, 10, 20, 0.95)'
        },
        'beta': {
            name: 'Beta Blue',
            primary: '#1E90FF',
            secondary: '#000080',
            accent: '#00BFFF',
            background: 'rgba(8, 20, 40, 0.98)',
            text: '#e6e6e6',
            gradient: 'linear-gradient(135deg, #1E90FF, #000080)',
            shadow: '0 0 30px rgba(30, 144, 255, 0.4)',
            watermarkBg: 'rgba(8, 20, 40, 0.95)'
        },
        'friend': {
            name: 'Friend Green',
            primary: '#32CD32',
            secondary: '#228B22',
            accent: '#00FF00',
            background: 'rgba(8, 20, 8, 0.98)',
            text: '#e6e6e6',
            gradient: 'linear-gradient(135deg, #32CD32, #228B22)',
            shadow: '0 0 30px rgba(50, 205, 50, 0.4)',
            watermarkBg: 'rgba(8, 20, 8, 0.95)'
        },
        'coder': {
            name: 'Coder Cyan',
            primary: '#00FFFF',
            secondary: '#008B8B',
            accent: '#48D1CC',
            background: 'rgba(8, 20, 30, 0.98)',
            text: '#e6e6e6',
            gradient: 'linear-gradient(135deg, #00FFFF, #008B8B)',
            shadow: '0 0 30px rgba(0, 255, 255, 0.4)',
            watermarkBg: 'rgba(8, 20, 30, 0.95)'
        },
        'trial': {
            name: 'Trial Orange',
            primary: '#FF8C00',
            secondary: '#FF4500',
            accent: '#FF6347',
            background: 'rgba(30, 15, 0, 0.98)',
            text: '#ffffff',
            gradient: 'linear-gradient(135deg, #FF8C00, #FF4500)',
            shadow: '0 0 30px rgba(255, 140, 0, 0.4)',
            watermarkBg: 'rgba(30, 15, 0, 0.95)'
        }
    };

    // ==========================================================
    //                 ⚙️ CONFIGURATION
    // ==========================================================
    const getSavedValue = (key, defaultValue) => {
        const saved = localStorage.getItem(key);
        if (saved !== null) {
            try {
                return isNaN(Number(saved)) ? JSON.parse(saved) : Number(saved);
            } catch (e) {
                return defaultValue;
            }
        }
        return defaultValue;
    };

    let enabled = false;
    let rps_enabled = getSavedValue('dynast_clicker_rps', false);
    let speedBoostEnabled = getSavedValue('dynast_clicker_speed_enabled', true);

    let currentTheme = getSavedValue('dynast_clicker_theme', 'premium');
    let currentScale = getSavedValue('dynast_clicker_scale', 1);
    let currentMode = getSavedValue('dynast_clicker_mode', 'time-e');
    let currentSpeedMode = getSavedValue('dynast_clicker_speed_mode', 'mid');
    let glowIntensity = getSavedValue('dynast_clicker_glow', 'medium');
    let glowEnabled = getSavedValue('dynast_clicker_glow_enabled', true);

    let watermarkTheme = getSavedValue('dynast_watermark_theme', 'premium');
    let watermarkGlowEnabled = getSavedValue('dynast_watermark_glow_enabled', true);
    let watermarkGlowIntensity = getSavedValue('dynast_watermark_glow_intensity', 'medium');

    // GUI border radius settings
    let guiBorderRadius = getSavedValue('dynast_gui_border_radius', 8);
    let watermarkBorderRadius = getSavedValue('dynast_watermark_border_radius', 8);

    // Visual modes
    let visualMode = getSavedValue('dynast_visual_mode', 'optimized');

    // Particles settings
    let particlesEnabled = getSavedValue('dynast_particles_enabled', true);
    let particleColor = getSavedValue('dynast_particle_color', '#FFFFFF');
    let particleStyle = getSavedValue('dynast_particle_style', 'snowflakes');
    let particleDisplayMode = getSavedValue('dynast_particle_display_mode', 'always');
    let particleGlowEnabled = getSavedValue('dynast_particle_glow_enabled', false);
    let particleGlowIntensity = getSavedValue('dynast_particle_glow_intensity', 'low');
    let particleCount = getSavedValue('dynast_particle_count', visualMode === 'optimized' ? 80 : 120);
    let particleSize = getSavedValue('dynast_particle_size', visualMode === 'optimized' ? 2 : 3);
    let particleSpeed = getSavedValue('dynast_particle_speed', 2.5);
    let particleFadeSpeed = getSavedValue('dynast_particle_fade_speed', 0.001);
    let particleWind = getSavedValue('dynast_particle_wind', 0.1);

    // Show particle settings
    let showParticleSettings = getSavedValue('dynast_show_particle_settings', false);

    // Speed configuration
    let cps = getSavedValue('dynast_clicker_cps', 500);
    let timeSpeedMultiplier = getSavedValue('dynast_clicker_time_speed_multiplier', 500);
    let clicksPerFrame = getSavedValue('dynast_clicker_packet_clicks', 25);
    let batchInterval = getSavedValue('dynast_clicker_batch_interval', 6);

    const MAX_CPS = 1000;
    const MAX_SPEED = 1000;
    const MAX_PACKET_CLICKS = 500;
    const MIN_BATCH_INTERVAL = 2;
    const MAX_BATCH_INTERVAL = 16;
    const MIN_SCALE = 0.7;
    const MAX_SCALE = 1.5;

    // Particle limits
    const MIN_PARTICLE_COUNT = 30;
    const MAX_PARTICLE_COUNT = 200;
    const MIN_PARTICLE_SIZE = 1;
    const MAX_PARTICLE_SIZE = 6;
    const MIN_PARTICLE_SPEED = 0.8;
    const MAX_PARTICLE_SPEED = 5;
    const MIN_PARTICLE_FADE_SPEED = 0.0005;
    const MAX_PARTICLE_FADE_SPEED = 0.005;
    const MIN_PARTICLE_WIND = 0;
    const MAX_PARTICLE_WIND = 0.5;

    // Border radius limits
    const MIN_BORDER_RADIUS = 1;
    const MAX_BORDER_RADIUS = 20;

    let lastBatchTime = 0;
    let batchQueue = 0;
    let timeEActive = false;

    let bindKey = getSavedValue('dynast_clicker_bind', ' ');
    let isWaitingForBind = false;
    let isBindPressed = false;

    // Chat mode system
    let isChatMode = false;
    let lastChatModeToggle = 0;
    const CHAT_MODE_COOLDOWN = 500;

    let lastClickTime_Normal = 0;
    let isChatActive = false;
    let lastChatCheck = 0;
    const CHAT_CHECK_INTERVAL = 100;

    const savedPos = getSavedValue('dynast_clicker_pos', {top: "20px", left: "20px"});
    let isCollapsed = getSavedValue('dynast_clicker_collapsed', false);

    let fpsValue = 60;
    let frames = 0;
    let lastFpsUpdateTime = performance.now();

    let realTimeCPS = 0;
    let clicksThisSecond = 0;
    let lastCPSUpdateTime = performance.now();
    let clickInterval = null;

    let pingValue = 25;
    let lastPingUpdate = performance.now();

    // Particle System
    let particles = [];
    let particleCanvas, particleCtx;
    let particleAnimationId = null;
    let lastParticleUpdate = 0;
    let PARTICLE_UPDATE_INTERVAL = 1000/60;

    // ==========================================================
    //                 🔐 CLOUD VALIDATION
    // ==========================================================
    async function validateWithCloud() {
        return new Promise((resolve) => {
            if (!userData) {
                resolve(false);
                return;
            }

            GM_xmlhttpRequest({
                method: 'POST',
                url: `${API_BASE}/validate`,
                headers: {
                    'Content-Type': 'application/json',
                    'X-HWID': userData.hwid
                },
                data: JSON.stringify({
                    hwid: userData.hwid,
                    key: userData.key
                }),
                timeout: 10000,
                onload: function(response) {
                    try {
                        const data = JSON.parse(response.responseText);
                        if (data.valid) {
                            userRole = data.role.toUpperCase();
                            userNickname = userData.nickname.substring(0, 8);
                            isAuthorized = true;
                            console.log(`✅ Cloud validation successful: ${userNickname} [${userRole}]`);
                            resolve(true);
                        } else {
                            resolve(false);
                        }
                    } catch (e) {
                        resolve(false);
                    }
                },
                onerror: function() {
                    resolve(false);
                },
                ontimeout: function() {
                    resolve(false);
                }
            });
        });
    }

    async function initializeCloudSystem() {
        console.log('⚡ Initializing Tamp. Cloud System...');
        
        userData = GM_getValue('tamp_user_data', null);
        
        if (userData && userData.hwid && userData.key) {
            const isValid = await validateWithCloud();
            if (isValid) {
                startMainSystem();
            } else {
                showCloudAuth();
            }
        } else {
            showCloudAuth();
        }
    }

    function showCloudAuth() {
        const overlay = document.createElement('div');
        overlay.id = 'tamp-cloud-auth';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: radial-gradient(circle at center, #0a0a15 0%, #000000 100%);
            z-index: 2147483647;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: 'Inter', sans-serif;
            backdrop-filter: blur(10px);
        `;

        overlay.innerHTML = `
            <div style="
                background: rgba(20, 20, 35, 0.95);
                border: 2px solid #8A2BE2;
                border-radius: 15px;
                padding: 30px;
                backdrop-filter: blur(20px);
                box-shadow: 0 0 50px rgba(138, 43, 226, 0.4);
                max-width: 450px;
                width: 90%;
                text-align: center;
            ">
                <h2 style="color: #FFD700; margin-top: 0; font-size: 24px;">⚡ TAMP.CLOUD</h2>
                <p style="color: #8A2BE2; margin-bottom: 25px;">Cloud Activation Required</p>
                
                <div style="color: #ccc; margin-bottom: 20px; font-size: 14px;">
                    Please use the Tamp. Cloud Loader to activate your license.
                </div>
                
                <div style="
                    background: rgba(138, 43, 226, 0.1);
                    padding: 15px;
                    border-radius: 10px;
                    margin: 20px 0;
                    border: 1px solid rgba(138, 43, 226, 0.3);
                ">
                    <div style="color: #FFD700; font-weight: bold; margin-bottom: 10px;">Available Roles:</div>
                    <div style="display: flex; justify-content: space-around; flex-wrap: wrap; gap: 10px;">
                        <span style="color: #FFD700;">PREMIUM</span>
                        <span style="color: #1E90FF;">BETA</span>
                        <span style="color: #32CD32;">FRIEND</span>
                        <span style="color: #00FFFF;">CODER</span>
                    </div>
                </div>
                
                <button id="retry-cloud" style="
                    padding: 12px 30px;
                    background: linear-gradient(135deg, #8A2BE2, #4B0082);
                    border: none;
                    border-radius: 8px;
                    color: white;
                    font-weight: 700;
                    cursor: pointer;
                    margin-top: 15px;
                ">Retry Connection</button>
            </div>
        `;

        document.body.appendChild(overlay);

        document.getElementById('retry-cloud').addEventListener('click', async () => {
            const isValid = await validateWithCloud();
            if (isValid) {
                overlay.remove();
                startMainSystem();
            }
        });
    }

    function startMainSystem() {
        console.log('🚀 Starting Tamp. Main System...');
        applyTheme(userRole.toLowerCase());
        applyWatermarkTheme(userRole.toLowerCase());
        buildGUI();
        requestAnimationFrame(gameLoop);
        startClickInterval();
        initParticles();
    }

    // ==========================================================
    //                 🎨 THEME MANAGEMENT
    // ==========================================================
    function applyTheme(themeName) {
        const theme = themes[themeName] || themes['premium'];
        if (!theme) return;

        currentTheme = themeName;
        localStorage.setItem('dynast_clicker_theme', themeName);

        const root = document.documentElement;
        root.style.setProperty('--primary-color', theme.primary);
        root.style.setProperty('--secondary-color', theme.secondary);
        root.style.setProperty('--accent-color', theme.accent);
        root.style.setProperty('--background-color', theme.background);
        root.style.setProperty('--text-color', theme.text);
        root.style.setProperty('--gradient', theme.gradient);

        updateGlowEffect();

        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.classList.remove('active-theme');
            if (btn.dataset.theme === themeName) {
                btn.classList.add('active-theme');
            }
        });

        const modeToggle = document.getElementById('mode-toggle');
        const toggleButton = document.getElementById('clicker-toggle');
        const speedBoostToggle = document.getElementById('speed-boost-toggle');
        const bindButton = document.getElementById('bind-button');

        if (modeToggle && currentMode === 'time-e') {
            modeToggle.style.background = theme.gradient;
        }

        if (toggleButton && enabled) {
            toggleButton.style.background = theme.gradient;
        }

        if (speedBoostToggle && speedBoostEnabled) {
            speedBoostToggle.style.background = theme.gradient;
        }

        if (bindButton) {
            bindButton.style.borderColor = theme.primary;
            bindButton.style.color = theme.primary;
        }

        const menu = document.getElementById('clicker-menu');
        if (menu) {
            menu.style.borderColor = theme.primary;
            menu.style.background = theme.background;
        }
    }

    function updateGlowEffect() {
        if (!glowEnabled) {
            document.documentElement.style.setProperty('--shadow-effect', 'none');
            const menu = document.getElementById('clicker-menu');
            if (menu) {
                menu.style.boxShadow = '0 20px 70px rgba(0,0,0,0.25)';
            }
            return;
        }

        const theme = themes[currentTheme] || themes['premium'];
        let shadowValue;

        switch(glowIntensity) {
            case 'low':
                shadowValue = `0 0 15px ${theme.primary}20`;
                break;
            case 'medium':
                shadowValue = `0 0 25px ${theme.primary}30`;
                break;
            case 'high':
                shadowValue = `0 0 35px ${theme.primary}40`;
                break;
            default:
                shadowValue = `0 0 25px ${theme.primary}30`;
        }

        document.documentElement.style.setProperty('--shadow-effect', shadowValue);

        const menu = document.getElementById('clicker-menu');
        if (menu) {
            menu.style.boxShadow = `0 20px 70px rgba(0,0,0,0.25), ${shadowValue}`;
        }
    }

    function toggleGlow(enabled) {
        glowEnabled = enabled;
        localStorage.setItem('dynast_clicker_glow_enabled', enabled);
        updateGlowEffect();
        updateSettingsVisibility();
    }

    function applyGlowIntensity(intensity) {
        glowIntensity = intensity;
        localStorage.setItem('dynast_clicker_glow', intensity);
        updateGlowEffect();
    }

    function applyWatermarkTheme(themeName) {
        const theme = themes[themeName] || themes['premium'];
        if (!theme) return;

        watermarkTheme = themeName;
        localStorage.setItem('dynast_watermark_theme', themeName);

        updateWatermarkGlow();

        document.querySelectorAll('.watermark-theme-btn').forEach(btn => {
            btn.classList.remove('active-theme');
            if (btn.dataset.theme === themeName) {
                btn.classList.add('active-theme');
            }
        });
    }

    function updateWatermarkGlow() {
        const watermark = document.getElementById('watermark-info');
        if (!watermark) return;

        const theme = themes[watermarkTheme] || themes['premium'];

        if (!watermarkGlowEnabled) {
            watermark.style.boxShadow = '0 10px 50px rgba(0,0,0,0.8)';
            return;
        }

        let shadowValue;
        switch(watermarkGlowIntensity) {
            case 'low':
                shadowValue = `0 0 15px ${theme.primary}40`;
                break;
            case 'medium':
                shadowValue = `0 0 25px ${theme.primary}60`;
                break;
            case 'high':
                shadowValue = `0 0 35px ${theme.primary}80`;
                break;
            default:
                shadowValue = `0 0 25px ${theme.primary}60`;
        }

        watermark.style.boxShadow = `0 10px 50px rgba(0,0,0,0.8), ${shadowValue}`;
    }

    function toggleWatermarkGlow(enabled) {
        watermarkGlowEnabled = enabled;
        localStorage.setItem('dynast_watermark_glow_enabled', enabled);
        updateWatermarkGlow();
        updateSettingsVisibility();
    }

    function applyWatermarkGlowIntensity(intensity) {
        watermarkGlowIntensity = intensity;
        localStorage.setItem('dynast_watermark_glow_intensity', intensity);
        updateWatermarkGlow();
    }

    // ==========================================================
    //                 ⚡ CORE FUNCTIONALITY
    // ==========================================================
    function toggleEnabled() {
        if (!isAuthorized) return;
        
        enabled = !enabled;
        const toggleButton = document.getElementById('clicker-toggle');
        if (toggleButton) {
             toggleButton.className = enabled ? 'clicker-toggle-on' : 'clicker-toggle-off';
             toggleButton.innerText = enabled ? 'ON' : 'OFF';
             toggleButton.style.animation = 'pulseGlow 0.4s ease';
             setTimeout(() => {
                 toggleButton.style.animation = '';
             }, 400);
        }
        if (!enabled) {
            setTimeSpeed(1);
            timeEActive = false;
            batchQueue = 0;
        }

        updateScriptStatus();
    }

    function updateScriptStatus() {
        const scriptStatusElement = document.getElementById('wm-script-status');
        if (scriptStatusElement) {
            scriptStatusElement.textContent = enabled ? 'ON' : 'OFF';
            scriptStatusElement.style.color = enabled ? '#27ae60' : '#FF6B6B';
            scriptStatusElement.style.background = enabled ?
                'rgba(39, 174, 96, 0.2)' : 'rgba(255, 107, 107, 0.2)';
        }
    }

    // ==========================================================
    //                 🧩 GUI SYSTEM - UPDATED
    // ==========================================================
    function buildGUI() {
        const style = `
            :root {
                --primary-color: #FFD700;
                --secondary-color: #D4AF37;
                --accent-color: #FFA500;
                --background-color: rgba(10, 10, 20, 0.98);
                --text-color: #ffffff;
                --gradient: linear-gradient(135deg, #FFD700, #D4AF37);
                --shadow-effect: 0 0 30px rgba(255, 215, 0, 0.4);
            }

            @keyframes pulseGlow {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.05); }
            }

            @keyframes valuePop {
                0% { transform: scale(1); }
                50% { transform: scale(1.1); }
                100% { transform: scale(1); }
            }

            @keyframes float {
                0%, 100% { transform: translateY(0px); }
                50% { transform: translateY(-5px); }
            }

            #clicker-menu {
                position: fixed;
                top: ${savedPos.top};
                left: ${savedPos.left};
                background: var(--background-color);
                backdrop-filter: blur(25px);
                border: 1.5px solid var(--primary-color);
                border-radius: ${guiBorderRadius}px;
                padding: 20px;
                font-family: 'Inter', sans-serif;
                color: var(--text-color);
                z-index: 99999;
                width: 480px;
                box-shadow: 0 20px 70px rgba(0,0,0,0.25), var(--shadow-effect);
                user-select: none;
                transition: all 0.3s ease;
                transform: scale(${currentScale});
                transform-origin: top left;
            }

            .tabs-container {
                display: flex;
                margin-bottom: 20px;
                border-bottom: 1px solid var(--primary-color)40;
            }

            .tab-btn {
                padding: 10px 20px;
                background: transparent;
                border: none;
                color: var(--text-color);
                cursor: pointer;
                font-weight: 600;
                transition: all 0.3s ease;
                border-radius: 8px 8px 0 0;
            }

            .tab-btn.active {
                background: var(--primary-color)30;
                color: var(--primary-color);
            }

            .tab-content {
                display: none;
            }

            .tab-content.active {
                display: block;
            }

            #clicker-header {
                cursor: move;
                padding-bottom: 16px;
                border-bottom: 1px solid var(--primary-color);
                margin-bottom: 20px;
                font-weight: 800;
                font-size: 22px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                color: var(--primary-color);
                user-select: none;
            }

            #collapse-btn {
                cursor: pointer;
                font-size: 18px;
                color: var(--primary-color);
                background: rgba(255, 215, 0, 0.1);
                border: 1px solid var(--primary-color);
                padding: 6px 10px;
                border-radius: 8px;
                animation: float 3s ease-in-out infinite;
                user-select: none;
            }

            .clicker-row {
                margin-bottom: 15px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 15px;
                transition: all 0.3s ease;
            }

            .clicker-toggle-on {
                background: var(--gradient);
                color: #000;
                border: none;
                padding: 12px 20px;
                border-radius: 10px;
                font-weight: 800;
                cursor: pointer;
                box-shadow: var(--shadow-effect);
            }

            .clicker-toggle-off {
                background: rgba(42, 42, 62, 0.8);
                color: #888;
                border: 1px solid #3A3A4E;
                padding: 12px 20px;
                border-radius: 10px;
                font-weight: 800;
                cursor: pointer;
            }

            .speed-mode-btn {
                padding: 10px 15px;
                border: none;
                border-radius: 8px;
                font-weight: 800;
                cursor: pointer;
                transition: all 0.3s ease;
                flex: 1;
            }

            .speed-mode-low { background: linear-gradient(135deg, #27ae60, #2ecc71); }
            .speed-mode-mid { background: linear-gradient(135deg, #f39c12, #f1c40f); }
            .speed-mode-max { background: linear-gradient(135deg, #e74c3c, #c0392b); }

            .speed-mode-active {
                box-shadow: 0 0 20px currentColor;
                transform: scale(1.05);
            }

            .theme-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 8px;
                margin: 10px 0;
            }

            .theme-btn, .watermark-theme-btn {
                padding: 8px;
                border: 2px solid transparent;
                border-radius: 6px;
                cursor: pointer;
                font-size: 10px;
                font-weight: 600;
                text-align: center;
                background: rgba(255,255,255,0.1);
                color: var(--text-color);
                transition: all 0.3s ease;
            }

            .theme-btn::before, .watermark-theme-btn::before {
                content: '';
                display: block;
                height: 3px;
                background: var(--theme-color);
                margin-bottom: 4px;
                border-radius: 2px;
            }

            .active-theme {
                border-color: var(--theme-color);
                box-shadow: 0 0 10px var(--theme-color);
            }

            ${Object.keys(themes).map(theme => `
                .theme-btn[data-theme="${theme}"], .watermark-theme-btn[data-theme="${theme}"] {
                    --theme-color: ${themes[theme].primary};
                }
            `).join('')}

            /* FIXED WATERMARK STYLES WITH ROLE DISPLAY */
            #watermark-info {
                position: fixed;
                top: 15px;
                right: 15px;
                display: flex;
                align-items: center;
                gap: 15px;
                padding: 12px 18px;
                background: ${themes[watermarkTheme].watermarkBg};
                border: 1.5px solid ${themes[watermarkTheme].primary};
                border-radius: ${watermarkBorderRadius}px;
                backdrop-filter: blur(15px) saturate(180%);
                font-size: 13px;
                font-weight: 700;
                color: ${themes[watermarkTheme].text};
                z-index: 100000;
                user-select: none;
                cursor: move;
                transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
                animation: float 4s ease-in-out infinite;
            }

            .watermark-section {
                display: flex;
                align-items: center;
                gap: 8px;
                white-space: nowrap;
            }

            .wm-name {
                color: ${themes[watermarkTheme].primary};
                font-weight: 900;
                text-shadow: 0 0 15px ${themes[watermarkTheme].primary};
                animation: pulseGlow 3s infinite;
            }

            .wm-role {
                color: ${themes[watermarkTheme].accent};
                font-weight: 800;
                text-shadow: 0 0 10px ${themes[watermarkTheme].accent};
            }

            .wm-stats {
                display: flex;
                align-items: center;
                gap: 12px;
            }

            .wm-stat {
                display: flex;
                align-items: center;
                gap: 4px;
                font-size: 12px;
                font-weight: 700;
            }

            .stat-value {
                color: #ddd;
                background: ${themes[watermarkTheme].primary}20;
                padding: 2px 6px;
                border-radius: 4px;
                border: 1px solid ${themes[watermarkTheme].primary}40;
                min-width: 45px;
                text-align: center;
            }

            .stat-label {
                color: #999;
                font-size: 10px;
                text-transform: uppercase;
            }

            #wm-toggle {
                cursor: pointer;
                font-size: 16px;
                padding: 6px;
                border-radius: 8px;
                background: ${themes[watermarkTheme].primary}20;
                border: 1px solid ${themes[watermarkTheme].primary}40;
                transition: all 0.3s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                user-select: none;
            }

            #wm-toggle:hover {
                transform: scale(1.2) rotate(15deg);
                background: ${themes[watermarkTheme].primary}30;
                animation: boltSpin 0.8s ease;
            }

            #wm-toggle .bolt {
                display: inline-block;
                transform-origin: center;
                animation: float 3s ease-in-out infinite;
                font-weight: 900;
                color: ${themes[watermarkTheme].primary};
                text-shadow: 0 0 12px ${themes[watermarkTheme].primary};
            }

            @keyframes boltSpin {
                0% { transform: rotate(0deg) scale(1); }
                50% { transform: rotate(180deg) scale(1.2); }
                100% { transform: rotate(360deg) scale(1); }
            }
        `;

        const html = `
            <div id="clicker-menu">
                <div id="clicker-header">
                    <span>⚡ Tamp. Cloud v5.2.5</span>
                    <button id="collapse-btn">⚡</button>
                </div>

                <div id="clicker-body">
                    <div class="tabs-container">
                        <button class="tab-btn active" data-tab="main">Main</button>
                        <button class="tab-btn" data-tab="interface">Interface</button>
                        <button class="tab-btn" data-tab="watermark">Watermark</button>
                        <button class="tab-btn" data-tab="effects">Effects</button>
                        <button class="tab-btn" data-tab="changelog">Updates</button>
                    </div>

                    <div class="tab-content active" id="main-tab">
                        <div class="clicker-row">
                            <button id="clicker-toggle" class="${enabled ? 'clicker-toggle-on' : 'clicker-toggle-off'}">${enabled ? 'ON' : 'OFF'}</button>
                            <button id="mode-toggle" class="clicker-toggle-${currentMode === 'time-e' ? 'on' : 'off'}">${currentMode === 'time-e' ? 'TIME-E' : 'NORMAL'}</button>
                        </div>

                        <div class="clicker-row">
                            <button id="speed-low" class="speed-mode-btn speed-mode-low ${currentSpeedMode === 'low' ? 'speed-mode-active' : ''}">LOW</button>
                            <button id="speed-mid" class="speed-mode-btn speed-mode-mid ${currentSpeedMode === 'mid' ? 'speed-mode-active' : ''}">MID</button>
                            <button id="speed-max" class="speed-mode-btn speed-mode-max ${currentSpeedMode === 'max' ? 'speed-mode-active' : ''}">MAX</button>
                        </div>

                        <div class="clicker-row" id="cps-setting">
                            <label>CPS:</label>
                            <div>
                                <div id="cps-label">${cps}</div>
                                <input type="range" id="cps-slider" min="1" max="${MAX_CPS}" value="${cps}">
                            </div>
                        </div>

                        <div class="clicker-row">
                            <label>Time Speed:</label>
                            <div>
                                <div id="time-speed-label">x${timeSpeedMultiplier}</div>
                                <input type="range" id="time-speed-slider" min="1" max="${MAX_SPEED}" value="${timeSpeedMultiplier}">
                            </div>
                        </div>

                        <div class="clicker-row" id="packet-settings">
                            <label>Packet Clicks:</label>
                            <div>
                                <div id="packet-clicks-label">${clicksPerFrame}</div>
                                <input type="range" id="packet-clicks-slider" min="1" max="${MAX_PACKET_CLICKS}" value="${clicksPerFrame}">
                            </div>
                        </div>

                        <div class="clicker-row" id="batch-settings">
                            <label>Batch Interval:</label>
                            <div>
                                <div id="batch-interval-label">${batchInterval}ms</div>
                                <input type="range" id="batch-interval-slider" min="${MIN_BATCH_INTERVAL}" max="${MAX_BATCH_INTERVAL}" value="${batchInterval}">
                            </div>
                        </div>

                        <div class="clicker-row">
                            <button id="speed-boost-toggle" class="${speedBoostEnabled ? 'clicker-toggle-on' : 'clicker-toggle-off'}">${speedBoostEnabled ? 'SPEED: ON' : 'SPEED: OFF'}</button>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <button id="bind-button" class="bind-button">BIND</button>
                                <div id="bind-display">${bindKey === ' ' ? 'Space' : bindKey}</div>
                            </div>
                        </div>
                    </div>

                    <!-- Other tabs remain the same but with updated themes -->
                    <div class="tab-content" id="interface-tab">
                        <div class="clicker-row">
                            <label>Interface Theme:</label>
                        </div>
                        <div class="theme-grid">
                            ${Object.entries(themes).map(([key, theme]) => `
                                <button class="theme-btn ${key === currentTheme ? 'active-theme' : ''}" data-theme="${key}">
                                    ${theme.name}
                                </button>
                            `).join('')}
                        </div>
                        <!-- Rest of interface settings -->
                    </div>

                    <!-- Other tabs... -->
                </div>
            </div>

            <!-- ENHANCED WATERMARK WITH ROLE DISPLAY -->
            <div id="watermark-info">
                <div class="watermark-section">
                    <span class="wm-name">${userNickname}</span>
                    <span class="wm-role">${userRole}</span>
                </div>

                <div class="wm-stats">
                    <div class="wm-stat">
                        <span class="stat-label">SCRIPT:</span>
                        <span id="wm-script-status" class="stat-value">${enabled ? 'ON' : 'OFF'}</span>
                    </div>
                    <div class="wm-stat">
                        <span class="stat-label">FPS:</span>
                        <span id="wm-fps" class="stat-value">${fpsValue}</span>
                    </div>
                    <div class="wm-stat">
                        <span class="stat-label">CPS:</span>
                        <span id="wm-cps" class="stat-value">${realTimeCPS}</span>
                    </div>
                    <div class="wm-stat">
                        <span class="stat-label">PING:</span>
                        <span id="wm-ping" class="stat-value">${pingValue}ms</span>
                    </div>
                    <div class="wm-stat">
                        <span class="stat-label">MODE:</span>
                        <span id="wm-chat-status" class="stat-value">${isChatMode ? 'CHAT' : 'CLICK'}</span>
                    </div>
                </div>

                <div id="wm-toggle" title="Toggle GUI">
                    <span class="bolt">⚡</span>
                </div>
            </div>
        `;

        document.head.insertAdjacentHTML('beforeend', `<style>${style}</style>`);
        document.body.insertAdjacentHTML('beforeend', html);

        // Initialize all systems
        applyTheme(currentTheme);
        applyWatermarkTheme(watermarkTheme);
        applyGUIBorderRadius(guiBorderRadius);
        applyWatermarkBorderRadius(watermarkBorderRadius);
        updateWatermarkGlow();
        updateSpeedSettings();
        updateSettingsVisibility();
        updateChatModeDisplay();
        updateScriptStatus();

        // Add event listeners and other initialization code...
        setupEventListeners();
    }

    function setupEventListeners() {
        // Add all the event listeners from the original script
        // This would include all the button clicks, sliders, etc.
        // For brevity, I'm showing the structure
        
        const toggleButton = document.getElementById('clicker-toggle');
        if (toggleButton) {
            toggleButton.addEventListener('click', toggleEnabled);
        }

        // Add other event listeners...
    }

    // ==========================================================
    //                 🚀 INITIALIZATION
    // ==========================================================
    setTimeout(() => {
        initializeCloudSystem();
    }, 2000);

    // Include all the other functions from the original script:
    // - Particle system functions
    // - Draggable system functions  
    // - Clicker logic functions
    // - Game loop functions
    // - etc.

})();
