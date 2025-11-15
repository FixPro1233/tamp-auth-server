// ==UserScript==
// @name         Tamp. Cloud Loader v4.0
// @namespace    http://tampermonkey.net/
// @version      4.0.0
// @description  Secure cloud activation for Tamp. by FixPro
// @author       FixPro
// @match        https://dynast.io/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      localhost:3000
// @connect      *.onrender.com
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    if (window.__tamp_cloud_loader_v4) return;
    window.__tamp_cloud_loader_v4 = true;

    // 🔧 КОНФИГУРАЦИЯ - ЗАМЕНИТЕ НА ВАШ СЕРВЕР ПОСЛЕ ДЕПЛОЯ
    const API_BASE = 'http://localhost:3000/api'; // Для тестов локально
    // const API_BASE = 'https://your-app.onrender.com/api'; // После деплоя

    let userHWID = GM_getValue('tamp_hwid', null);
    let userData = GM_getValue('tamp_user_data', null);
    let serverOnline = false;

    // 🆔 ГЕНЕРАЦИЯ HWID
    function generateHWID() {
        const components = [
            navigator.userAgent,
            navigator.platform,
            navigator.hardwareConcurrency || 'unknown',
            screen.width + 'x' + screen.height,
            Intl.DateTimeFormat().resolvedOptions().timeZone,
            navigator.language,
            (navigator.deviceMemory || 'unknown') + 'GB'
        ];
        
        let hash = 0;
        const str = components.join('|');
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return 'TAMP_' + Math.abs(hash).toString(36).toUpperCase() + '_' + Date.now().toString(36).slice(-6);
    }

    // 🚀 ОСНОВНАЯ ИНИЦИАЛИЗАЦИЯ
    async function initialize() {
        console.log('⚡ Tamp. Cloud Loader v4.0 initializing...');
        
        if (!userHWID) {
            userHWID = generateHWID();
            GM_setValue('tamp_hwid', userHWID);
            console.log('🆔 Generated new HWID:', userHWID);
        }

        // Проверяем статус сервера
        serverOnline = await checkServerStatus();
        
        if (userData && userData.key) {
            if (serverOnline) {
                await validateSession();
            } else {
                loadFromCache();
            }
        } else {
            showAuthInterface();
        }
    }

    // 🌐 ПРОВЕРКА СЕРВЕРА
    async function checkServerStatus() {
        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `${API_BASE}/health`,
                timeout: 5000,
                onload: function(response) {
                    if (response.status === 200) {
                        console.log('✅ Server is online');
                        resolve(true);
                    } else {
                        console.log('❌ Server responded with error:', response.status);
                        resolve(false);
                    }
                },
                onerror: function() {
                    console.log('🔴 Server is offline');
                    resolve(false);
                },
                ontimeout: function() {
                    console.log('⏰ Server timeout');
                    resolve(false);
                }
            });
        });
    }

    // 🔐 ВАЛИДАЦИЯ СЕССИИ
    async function validateSession() {
        try {
            const response = await makeRequest('POST', '/validate', {
                hwid: userHWID,
                key: userData.key
            });

            if (response.valid) {
                console.log('✅ Session validated for:', userData.nickname);
                userData.lastValidation = Date.now();
                GM_setValue('tamp_user_data', userData);
                loadMainScript();
            } else {
                console.log('❌ Session invalid, showing auth');
                GM_setValue('tamp_user_data', null);
                userData = null;
                showAuthInterface();
            }
        } catch (error) {
            console.warn('Session validation failed, using cache');
            loadFromCache();
        }
    }

    // 💾 ЗАГРУЗКА ИЗ КЭША
    function loadFromCache() {
        const cached = GM_getValue('tamp_cached_script');
        if (cached && Date.now() - cached.timestamp < 7 * 24 * 60 * 60 * 1000) {
            console.log('📦 Loading from cache');
            executeScript(cached.code);
            showNotification('⚡ Tamp. loaded from cache (offline mode)');
        } else {
            showAuthInterface();
        }
    }

    // 🎨 ИНТЕРФЕЙС АВТОРИЗАЦИИ
    function showAuthInterface() {
        const overlay = document.createElement('div');
        overlay.id = 'tamp-auth-overlay';
        overlay.innerHTML = `
            <div class="tamp-auth-container">
                <div class="tamp-auth-header">
                    <h1>⚡ TAMP.CLOUD</h1>
                    <p>by FixPro • Secure Activation</p>
                    <div class="tamp-status ${serverOnline ? 'online' : 'offline'}">
                        ${serverOnline ? '🟢 СЕРВЕР ONLINE' : '🔴 СЕРВЕР OFFLINE'}
                    </div>
                </div>
                
                <div class="tamp-auth-form">
                    <input type="text" id="tamp-nickname" placeholder="Ваш игровой ник" maxlength="20" autocomplete="off">
                    <input type="text" id="tamp-key" placeholder="Ключ активации (XXXX-XXXX-XXXX)" maxlength="19" autocomplete="off">
                    <button id="tamp-activate-btn">АКТИВИРОВАТЬ</button>
                    <div id="tamp-message" class="tamp-message"></div>
                </div>

                <div class="tamp-auth-info">
                    <div class="tamp-info-item">🔐 Защищенная облачная активация</div>
                    <div class="tamp-info-item">⚡ Автоматические обновления</div>
                    <div class="tamp-info-item">🌐 Работа через защищенный сервер</div>
                </div>

                <div class="tamp-stats">
                    <div class="tamp-stat">
                        <span>HWID:</span>
                        <span class="tamp-hwid">${userHWID}</span>
                    </div>
                </div>
            </div>

            <style>
                #tamp-auth-overlay {
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
                    font-family: 'Inter', 'Segoe UI', Tahoma, sans-serif;
                    backdrop-filter: blur(5px);
                }

                .tamp-auth-container {
                    background: rgba(20, 20, 35, 0.95);
                    border: 2px solid #8A2BE2;
                    border-radius: 15px;
                    padding: 35px;
                    text-align: center;
                    backdrop-filter: blur(20px);
                    box-shadow: 0 0 50px rgba(138, 43, 226, 0.4);
                    max-width: 400px;
                    width: 90%;
                    animation: tampSlideIn 0.5s ease-out;
                }

                @keyframes tampSlideIn {
                    from { opacity: 0; transform: translateY(-30px) scale(0.9); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }

                .tamp-auth-header h1 {
                    color: #FFD700;
                    font-size: 2.3em;
                    margin: 0;
                    text-shadow: 0 0 20px rgba(255, 215, 0, 0.5);
                    font-weight: 800;
                    letter-spacing: 1px;
                }

                .tamp-auth-header p {
                    color: #8A2BE2;
                    margin: 5px 0 15px 0;
                    font-weight: 600;
                    font-size: 14px;
                }

                .tamp-status {
                    padding: 6px 12px;
                    border-radius: 20px;
                    font-size: 11px;
                    font-weight: 700;
                    margin: 10px 0;
                    display: inline-block;
                }

                .tamp-status.online {
                    background: rgba(46, 204, 113, 0.2);
                    color: #2ecc71;
                    border: 1px solid #2ecc71;
                }

                .tamp-status.offline {
                    background: rgba(231, 76, 60, 0.2);
                    color: #e74c3c;
                    border: 1px solid #e74c3c;
                }

                .tamp-auth-form {
                    margin: 20px 0;
                }

                .tamp-auth-form input {
                    width: 100%;
                    padding: 12px 15px;
                    margin: 8px 0;
                    background: rgba(255, 255, 255, 0.1);
                    border: 2px solid #8A2BE2;
                    border-radius: 8px;
                    color: white;
                    font-size: 14px;
                    box-sizing: border-box;
                    transition: all 0.3s ease;
                    text-align: center;
                }

                .tamp-auth-form input:focus {
                    outline: none;
                    border-color: #FFD700;
                    box-shadow: 0 0 15px rgba(255, 215, 0, 0.3);
                    background: rgba(255, 255, 255, 0.15);
                }

                .tamp-auth-form input::placeholder {
                    color: #888;
                }

                #tamp-activate-btn {
                    width: 100%;
                    padding: 12px;
                    margin: 10px 0;
                    background: linear-gradient(135deg, #8A2BE2, #4B0082);
                    border: none;
                    border-radius: 8px;
                    color: white;
                    font-weight: 700;
                    cursor: pointer;
                    font-size: 14px;
                    transition: all 0.3s ease;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }

                #tamp-activate-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 5px 20px rgba(138, 43, 226, 0.4);
                    background: linear-gradient(135deg, #9932CC, #8A2BE2);
                }

                #tamp-activate-btn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                    transform: none;
                }

                .tamp-message {
                    min-height: 20px;
                    margin: 10px 0;
                    font-size: 12px;
                    font-weight: 600;
                    transition: all 0.3s ease;
                }

                .tamp-message.error {
                    color: #FF6B6B;
                }

                .tamp-message.success {
                    color: #27ae60;
                }

                .tamp-auth-info {
                    margin: 20px 0;
                    padding: 15px;
                    background: rgba(138, 43, 226, 0.1);
                    border-radius: 8px;
                    border: 1px solid rgba(138, 43, 226, 0.3);
                }

                .tamp-info-item {
                    color: #ccc;
                    margin: 5px 0;
                    font-size: 11px;
                }

                .tamp-stats {
                    margin-top: 15px;
                    padding-top: 15px;
                    border-top: 1px solid rgba(138, 43, 226, 0.3);
                }

                .tamp-stat {
                    display: flex;
                    justify-content: space-between;
                    margin: 5px 0;
                    font-size: 10px;
                    color: #666;
                }

                .tamp-hwid {
                    color: #8A2BE2;
                    font-family: monospace;
                    font-size: 9px;
                }
            </style>
        `;

        document.body.appendChild(overlay);
        setupAuthHandlers();
        
        // Автофокус на поле ника
        setTimeout(() => {
            const nicknameInput = document.getElementById('tamp-nickname');
            if (nicknameInput) nicknameInput.focus();
        }, 300);
    }

    // 🎮 НАСТРОЙКА ОБРАБОТЧИКОВ АВТОРИЗАЦИИ
    function setupAuthHandlers() {
        const activateBtn = document.getElementById('tamp-activate-btn');
        const nicknameInput = document.getElementById('tamp-nickname');
        const keyInput = document.getElementById('tamp-key');
        const messageEl = document.getElementById('tamp-message');

        // Форматирование ключа в реальном времени
        keyInput.addEventListener('input', function(e) {
            let value = e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            if (value.length > 4) value = value.slice(0,4) + '-' + value.slice(4);
            if (value.length > 9) value = value.slice(0,9) + '-' + value.slice(9);
            if (value.length > 14) value = value.slice(0,14) + '-' + value.slice(14);
            e.target.value = value.slice(0, 19);
        });

        // Активация по клику
        activateBtn.addEventListener('click', handleActivation);

        // Активация по Enter
        const handleKeyPress = (e) => {
            if (e.key === 'Enter') {
                handleActivation();
            }
        };
        
        nicknameInput.addEventListener('keypress', handleKeyPress);
        keyInput.addEventListener('keypress', handleKeyPress);

        function showMessage(text, type) {
            messageEl.textContent = text;
            messageEl.className = `tamp-message ${type}`;
        }

        async function handleActivation() {
            const nickname = nicknameInput.value.trim();
            const key = keyInput.value.trim().replace(/-/g, '');

            // Валидация
            if (!nickname) {
                showMessage('Введите ваш игровой ник', 'error');
                nicknameInput.focus();
                return;
            }

            if (!key || key.length !== 16) {
                showMessage('Введите корректный ключ активации', 'error');
                keyInput.focus();
                return;
            }

            // Блокируем кнопку
            activateBtn.disabled = true;
            activateBtn.textContent = 'АКТИВАЦИЯ...';
            showMessage('Проверка ключа...', '');

            try {
                await activateUser(nickname, key);
            } catch (error) {
                console.error('Activation error:', error);
                showMessage('❌ Ошибка активации', 'error');
                activateBtn.disabled = false;
                activateBtn.textContent = 'АКТИВИРОВАТЬ';
            }
        }

        async function activateUser(nickname, key) {
            const response = await makeRequest('POST', '/activate', {
                nickname: nickname,
                key: key
            });

            if (response.success) {
                userData = {
                    nickname: nickname,
                    key: key,
                    role: response.role,
                    hwid: userHWID,
                    activatedAt: Date.now(),
                    lastValidation: Date.now()
                };
                
                GM_setValue('tamp_user_data', userData);
                showMessage('✅ Активация успешна! Загрузка...', 'success');
                
                setTimeout(() => {
                    hideAuthInterface();
                    loadMainScript();
                }, 1500);
                
            } else {
                showMessage('❌ ' + response.message, 'error');
                activateBtn.disabled = false;
                activateBtn.textContent = 'АКТИВИРОВАТЬ';
                
                // Подсвечиваем поле с ошибкой
                keyInput.style.borderColor = '#FF6B6B';
                setTimeout(() => {
                    keyInput.style.borderColor = '#8A2BE2';
                }, 2000);
            }
        }
    }

    // 🌐 УНИВЕРСАЛЬНЫЙ МЕТОД ЗАПРОСА
    function makeRequest(method, endpoint, data = null) {
        return new Promise((resolve, reject) => {
            const options = {
                method: method,
                url: API_BASE + endpoint,
                headers: {
                    'Content-Type': 'application/json',
                    'X-HWID': userHWID
                },
                timeout: 10000,
                onload: function(response) {
                    try {
                        const data = JSON.parse(response.responseText);
                        if (response.status === 200) {
                            resolve(data);
                        } else {
                            reject(new Error(data.message || `HTTP ${response.status}`));
                        }
                    } catch (e) {
                        reject(new Error('Invalid server response'));
                    }
                },
                onerror: function(error) {
                    reject(new Error('Network error'));
                },
                ontimeout: function() {
                    reject(new Error('Request timeout'));
                }
            };

            if (data) {
                options.data = JSON.stringify(data);
            }

            GM_xmlhttpRequest(options);
        });
    }

    // 📥 ЗАГРУЗКА ОСНОВНОГО СКРИПТА
    async function loadMainScript() {
        showNotification('⚡ Загрузка Tamp. Cloud...');
        
        try {
            const response = await makeRequest('GET', '/script');
            
            // Кэшируем скрипт
            GM_setValue('tamp_cached_script', {
                code: response.script,
                timestamp: Date.now(),
                version: response.version
            });

            executeScript(response.script);
            showNotification('✅ Tamp. Cloud успешно загружен!');
            
        } catch (error) {
            console.error('Failed to load script:', error);
            showNotification('❌ Ошибка загрузки, пробуем кэш...');
            loadFromCache();
        }
    }

    // 🔧 ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
    function executeScript(code) {
        const script = document.createElement('script');
        script.textContent = code;
        document.head.appendChild(script);
    }

    function hideAuthInterface() {
        const overlay = document.getElementById('tamp-auth-overlay');
        if (overlay) {
            overlay.style.opacity = '0';
            overlay.style.transform = 'scale(0.9)';
            setTimeout(() => {
                if (overlay.parentNode) {
                    overlay.parentNode.removeChild(overlay);
                }
            }, 300);
        }
    }

    function showNotification(message) {
        // Простое уведомление в консоль
        console.log('🔔 ' + message);
    }

    // 🚀 ЗАПУСК СИСТЕМЫ
    function startLoader() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initialize);
        } else {
            initialize();
        }
    }

    // ⏰ ОТСЛЕЖИВАНИЕ ВЫХОДА
    window.addEventListener('beforeunload', function() {
        if (userHWID) {
            // Можно отправлять статистику отключения
            console.log('👋 User leaving, HWID:', userHWID);
        }
    });

    // 🎬 ЗАПУСК ЛОАДЕРА
    startLoader();

})();
