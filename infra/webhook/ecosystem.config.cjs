const path = require('path');
const fs = require('fs');

// Load .env file to get WEBHOOK_SECRET
const envPath = '/srv/customer/sites/manager.mantodeus.com/.env';
let webhookSecret = process.env.WEBHOOK_SECRET;

if (!webhookSecret && fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const match = envContent.match(/^WEBHOOK_SECRET=(.+)$/m);
  if (match) {
    webhookSecret = match[1].trim();
  }
}

module.exports = {
  apps: [
    {
      name: 'webhook-listener',
      // Use wrapper script that ensures dependencies are available
      script: path.join(__dirname, 'start-webhook.sh'),
      cwd: '/srv/customer/sites/manager.mantodeus.com',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      // Prevent rapid restart loops
      min_uptime: '10s',        // Process must run for 10s before considered stable
      max_restarts: 10,          // Max 10 restarts within time_window
      restart_delay: 4000,       // Wait 4s between restarts
      exp_backoff_restart_delay: 100,  // Exponential backoff starting at 100ms
      time_window: '1h',        // Reset restart count after 1 hour
      // Keep process alive
      kill_timeout: 5000,       // Wait 5s for graceful shutdown
      listen_timeout: 10000,    // Wait 10s for app to start listening
      env: {
        NODE_ENV: 'production',
        // Ensure Node.js can find modules in the project's node_modules
        NODE_PATH: '/srv/customer/sites/manager.mantodeus.com/node_modules',
        // Load WEBHOOK_SECRET from .env file or environment
        WEBHOOK_SECRET: webhookSecret || '',
        // Optional: override port if needed
        WEBHOOK_PORT: process.env.WEBHOOK_PORT || '9000',
        // Optional: override app path if needed
        APP_PATH: process.env.APP_PATH || '/srv/customer/sites/manager.mantodeus.com',
        // Optional: override PM2 app name if needed
        PM2_APP_NAME: process.env.PM2_APP_NAME || 'mantodeus-manager',
      },
      interpreter: 'bash',
      error_file: '/srv/customer/.pm2/logs/webhook-listener-error.log',
      out_file: '/srv/customer/.pm2/logs/webhook-listener-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};
