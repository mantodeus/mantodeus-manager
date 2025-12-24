export default {
  apps: [
    {
      name: 'mantodeus-manager',
      script: 'npm',
      args: 'start',
      cwd: process.env.PWD || '/srv/customer/sites/manager.mantodeus.com',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
      },
      restart_delay: 2000,
      max_restarts: 10,
      min_uptime: '10s',
      error_file: './logs/mantodeus-manager-error.log',
      out_file: './logs/mantodeus-manager-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
  ],
};

