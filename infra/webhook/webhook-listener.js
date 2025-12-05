#!/usr/bin/env node
/**
 * GitHub Webhook Listener for Mantodeus Manager
 * 
 * This lightweight webhook server listens for GitHub push events
 * and triggers automated deployments.
 * 
 * Features:
 * - GitHub signature verification (HMAC-SHA256)
 * - Automatic deployment on push to main branch
 * - JSON logging
 * - Non-root execution
 * 
 * Usage:
 *   node webhook-listener.js
 * 
 * Environment Variables:
 *   WEBHOOK_SECRET - GitHub webhook secret (required)
 *   WEBHOOK_PORT - Port to listen on (default: 9000)
 *   PROJECT_DIR - Project directory (default: /srv/customer/sites/manager.mantodeus.com)
 *   DEPLOY_BRANCH - Branch to deploy (default: main)
 */

const http = require('http');
const crypto = require('crypto');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  port: process.env.WEBHOOK_PORT || 9000,
  secret: process.env.WEBHOOK_SECRET || '',
  projectDir: process.env.PROJECT_DIR || '/srv/customer/sites/manager.mantodeus.com',
  deployBranch: process.env.DEPLOY_BRANCH || 'main',
  logFile: process.env.WEBHOOK_LOG_FILE || null,
};

// Validate configuration
if (!CONFIG.secret) {
  console.error('ERROR: WEBHOOK_SECRET environment variable is required');
  console.error('Set it in your .env file or environment');
  process.exit(1);
}

// Check if running as root (not recommended)
if (process.getuid && process.getuid() === 0) {
  console.warn('WARNING: Running as root is not recommended for security');
}

/**
 * Log message with timestamp
 */
function log(level, message, data = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...data,
  };
  
  const logString = JSON.stringify(logEntry);
  console.log(logString);
  
  // Write to log file if configured
  if (CONFIG.logFile) {
    fs.appendFileSync(CONFIG.logFile, logString + '\n');
  }
}

/**
 * Verify GitHub webhook signature
 */
function verifySignature(payload, signature) {
  if (!signature) {
    return false;
  }
  
  const hmac = crypto.createHmac('sha256', CONFIG.secret);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');
  
  // Use timing-safe comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(digest)
    );
  } catch (e) {
    return false;
  }
}

/**
 * Execute deployment script
 */
function executeDeploy(payload) {
  const deployScript = path.join(CONFIG.projectDir, 'infra/deploy/deploy.sh');
  
  log('info', 'Starting deployment', {
    branch: payload.ref,
    commit: payload.after?.substring(0, 7),
    pusher: payload.pusher?.name,
  });
  
  const command = `cd ${CONFIG.projectDir} && ${deployScript}`;
  
  exec(command, { timeout: 300000 }, (error, stdout, stderr) => {
    if (error) {
      log('error', 'Deployment failed', {
        error: error.message,
        code: error.code,
        stderr: stderr.substring(0, 500),
      });
      return;
    }
    
    try {
      const result = JSON.parse(stdout);
      log('info', 'Deployment completed', result);
    } catch (e) {
      log('info', 'Deployment completed', {
        stdout: stdout.substring(0, 500),
      });
    }
  });
}

/**
 * Handle webhook request
 */
function handleWebhook(req, res) {
  let body = '';
  
  req.on('data', chunk => {
    body += chunk.toString();
  });
  
  req.on('end', () => {
    const signature = req.headers['x-hub-signature-256'];
    const event = req.headers['x-github-event'];
    
    // Verify signature
    if (!verifySignature(body, signature)) {
      log('warn', 'Invalid signature', {
        ip: req.socket.remoteAddress,
        event,
      });
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid signature' }));
      return;
    }
    
    // Parse payload
    let payload;
    try {
      payload = JSON.parse(body);
    } catch (e) {
      log('error', 'Invalid JSON payload', {
        error: e.message,
      });
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
      return;
    }
    
    log('info', 'Webhook received', {
      event,
      action: payload.action,
      repository: payload.repository?.full_name,
    });
    
    // Handle push events
    if (event === 'push') {
      const branch = payload.ref?.replace('refs/heads/', '');
      
      if (branch === CONFIG.deployBranch) {
        executeDeploy(payload);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'success',
          message: 'Deployment triggered',
          branch,
          commit: payload.after?.substring(0, 7),
        }));
      } else {
        log('info', 'Ignoring push to non-deploy branch', { branch });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'ignored',
          message: 'Not the deploy branch',
          branch,
        }));
      }
    } else {
      // Other events
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ignored',
        message: 'Event not handled',
        event,
      }));
    }
  });
}

/**
 * Create HTTP server
 */
const server = http.createServer((req, res) => {
  // Health check endpoint
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    }));
    return;
  }
  
  // Webhook endpoint
  if (req.url === '/webhook' && req.method === 'POST') {
    handleWebhook(req, res);
    return;
  }
  
  // 404 for other requests
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// Start server
server.listen(CONFIG.port, () => {
  log('info', 'Webhook listener started', {
    port: CONFIG.port,
    projectDir: CONFIG.projectDir,
    deployBranch: CONFIG.deployBranch,
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  log('info', 'Received SIGTERM, shutting down gracefully');
  server.close(() => {
    log('info', 'Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  log('info', 'Received SIGINT, shutting down gracefully');
  server.close(() => {
    log('info', 'Server closed');
    process.exit(0);
  });
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  log('error', 'Uncaught exception', {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  log('error', 'Unhandled rejection', {
    reason: String(reason),
  });
});
