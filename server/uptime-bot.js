const axios = require('axios');

class TampUptimeBot {
  constructor() {
    this.healthCheckUrl = 'http://localhost:3000/api/health';
    this.checkInterval = 60000; // 1 minute
    this.failures = 0;
    this.maxFailures = 3;
  }

  async checkHealth() {
    try {
      const response = await axios.get(this.healthCheckUrl, { timeout: 10000 });
      
      if (response.data.status === 'healthy') {
        this.failures = 0;
        console.log(`✅ [${new Date().toISOString()}] Server is healthy`);
        return true;
      } else {
        this.failures++;
        console.log(`❌ [${new Date().toISOString()}] Server is unhealthy`);
        return false;
      }
    } catch (error) {
      this.failures++;
      console.log(`🔴 [${new Date().toISOString()}] Server is down: ${error.message}`);
      
      if (this.failures >= this.maxFailures) {
        await this.sendCriticalAlert(`Server has been down for ${this.failures} consecutive checks`);
      }
      
      return false;
    }
  }

  async sendCriticalAlert(message) {
    // Здесь можно добавить отправку в Telegram/Discord/Email
    console.log(`🚨 CRITICAL ALERT: ${message}`);
    
    // Пример для Telegram (раскомментируйте и настройте):
    /*
    await axios.post('https://api.telegram.org/botYOUR_BOT_TOKEN/sendMessage', {
      chat_id: 'YOUR_CHAT_ID',
      text: `🚨 Tamp. Cloud Alert:\\n${message}\\nTime: ${new Date().toLocaleString()}`
    });
    */
  }

  start() {
    console.log('🔍 Uptime Bot started monitoring...');
    setInterval(() => this.checkHealth(), this.checkInterval);
    
    // First check
    this.checkHealth();
  }
}

// Start the bot
const bot = new TampUptimeBot();
bot.start();

module.exports = TampUptimeBot;
