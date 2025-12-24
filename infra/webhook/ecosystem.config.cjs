const path = require('path');

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
      env: {
        NODE_ENV: 'production',
        // Ensure Node.js can find modules in the project's node_modules
        NODE_PATH: '/srv/customer/sites/manager.mantodeus.com/node_modules',
      },
      interpreter: 'bash',
      error_file: '/srv/customer/.pm2/logs/webhook-listener-error.log',
      out_file: '/srv/customer/.pm2/logs/webhook-listener-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};
