module.exports = {
  apps: [
    {
      name: 'webhook-listener',
      script: './infra/webhook/webhook-listener.js',
      cwd: '/srv/customer/sites/manager.mantodeus.com',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production',
        NODE_PATH: './node_modules',
      },
      error_file: '/srv/customer/.pm2/logs/webhook-listener-error.log',
      out_file: '/srv/customer/.pm2/logs/webhook-listener-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};
