#!/usr/bin/env node
/**
 * Mantodeus Manager - GitHub Webhook Listener
 * 
 * Automatically deploys on push to main branch
 * 
 * Usage:
 *   # Option 1: Using ecosystem config (recommended)
 *   pm2 start infra/webhook/ecosystem.config.cjs
 *   
 *   # Option 2: Using wrapper script (ensures dependencies)
 *   pm2 start infra/webhook/start-webhook.sh --name webhook-listener
 *   
 *   # Option 3: Direct start (requires dependencies already installed)
 *   pm2 start infra/webhook/webhook-listener.js --name webhook-listener
 * 
 * Environment Variables:
 *   WEBHOOK_SECRET - GitHub webhook secret (required)
 *   WEBHOOK_PORT - Port to listen on (default: 9000)
 *   APP_PATH - Application path (default: /srv/customer/sites/manager.mantodeus.com)
 *   PM2_APP_NAME - PM2 app name (default: mantodeus-manager)
 *   NODE_PATH - Node.js module search path (should include node_modules directory)
 */

import express from 'express';
import crypto from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.WEBHOOK_PORT || 9000;
const SECRET = process.env.WEBHOOK_SECRET;
const APP_PATH = process.env.APP_PATH || '/srv/customer/sites/manager.mantodeus.com';
const PM2_APP_NAME = process.env.PM2_APP_NAME || 'mantodeus-manager';

// Track if server has started successfully
let serverStarted = false;

// CRITICAL: Fail fast if WEBHOOK_SECRET is not set
if (!SECRET) {
  console.error('❌ FATAL ERROR: WEBHOOK_SECRET environment variable is required for security.');
  console.error('   Set WEBHOOK_SECRET in your environment before starting the webhook listener.');
  console.error('   Generate a secret: openssl rand -hex 32');
  process.exit(1);
}

// Error handlers to prevent crashes
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  console.error('Stack:', error.stack);
  
  // Log to file if possible
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: 'fatal',
    message: 'Uncaught Exception',
    error: error.message,
    stack: error.stack,
  };
  fs.appendFile(
    path.join(APP_PATH, 'logs', 'webhook.log'),
    JSON.stringify(logEntry) + '\n'
  ).catch(() => {});
  
  // Exit with delay to prevent rapid restart loops
  setTimeout(() => {
    console.error('Exiting due to uncaught exception');
    process.exit(1);
  }, serverStarted ? 5000 : 2000);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection:', reason);
  if (reason instanceof Error) {
    console.error('Stack:', reason.stack);
  }
  
  // Log to file if possible
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: 'error',
    message: 'Unhandled Rejection',
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  };
  fs.appendFile(
    path.join(APP_PATH, 'logs', 'webhook.log'),
    JSON.stringify(logEntry) + '\n'
  ).catch(() => {});
  
  // Don't exit on unhandled rejections - they're often recoverable
  // But log them for debugging
});

// Log directory
const LOG_DIR = path.join(APP_PATH, 'logs');
const WEBHOOK_LOG = path.join(LOG_DIR, 'webhook.log');

// Ensure log directory exists
await fs.mkdir(LOG_DIR, { recursive: true }).catch(() => {});

// JSON logging helper
async function log(level, message, data = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...data,
  };
  
  const logLine = JSON.stringify(logEntry) + '\n';
  await fs.appendFile(WEBHOOK_LOG, logLine).catch(() => {});
  console.log(`[${level}] ${message}`, data);
}

// Verify GitHub signature
function verifySignature(payload, signature) {
  const hmac = crypto.createHmac('sha256', SECRET);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');

  // Timing-safe comparison
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(digest)
  );
}

// Middleware
app.use(express.json({ verify: (req, res, buf) => {
  req.rawBody = buf.toString();
}}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'webhook-listener',
    port: PORT,
    timestamp: new Date().toISOString(),
  });
});

// Webhook endpoint
app.post('/webhook', async (req, res) => {
  const signature = req.headers['x-hub-signature-256'];
  const event = req.headers['x-github-event'];
  const deliveryId = req.headers['x-github-delivery'];
  
  await log('info', 'Webhook received', {
    event,
    deliveryId,
    hasSignature: !!signature,
  });
  
  // Verify signature (always required)
  if (!signature) {
    await log('error', 'Missing signature', { deliveryId });
    return res.status(401).json({ error: 'Missing signature' });
  }

  if (!verifySignature(req.rawBody, signature)) {
    await log('error', 'Invalid signature', { deliveryId });
    return res.status(401).json({ error: 'Invalid signature' });
  }

  await log('info', 'Signature verified successfully', { deliveryId });
  
  // Handle ping event
  if (event === 'ping') {
    await log('info', 'Ping received');
    return res.status(200).json({ message: 'Pong!' });
  }
  
  // Handle push event
  if (event === 'push') {
    const ref = req.body.ref;
    const branch = ref ? ref.replace('refs/heads/', '') : '';
    
    await log('info', 'Push event received', { branch, ref });
    
    // Only deploy on main branch
    if (branch === 'main') {
      // Respond immediately
      res.status(202).json({
        status: 'accepted',
        message: 'Deployment started',
        branch,
        commit: req.body.head_commit?.id?.substring(0, 7) || 'unknown',
      });
      
      // Deploy asynchronously
      await deploy(branch, req.body.head_commit?.id);
    } else {
      await log('info', 'Ignoring push to non-main branch', { branch });
      return res.status(200).json({
        status: 'ignored',
        message: `Push to ${branch} branch ignored (only main branch triggers deployment)`,
      });
    }
  } else {
    await log('info', 'Ignoring event', { event });
    return res.status(200).json({
      status: 'ignored',
      message: `Event ${event} ignored`,
    });
  }
});

// Deployment function
async function deploy(branch, commitId) {
  try {
    await log('info', 'Starting deployment', { branch, commitId });
  } catch (logError) {
    console.error('Failed to log deployment start:', logError);
  }
  
  // Use the smart idempotent deploy script
  const deployScript = path.join(APP_PATH, 'scripts', 'deploy-prod.sh');
  
  try {
    // Check if deploy script exists
    await fs.access(deployScript);
    
    // Use the smart deploy script (idempotent - only runs what's needed)
    const { stdout, stderr } = await execAsync(`bash ${deployScript}`, {
      cwd: APP_PATH,
      maxBuffer: 10 * 1024 * 1024,
    });
    
    await log('info', 'Deployment completed', {
      stdout: stdout.substring(0, 500),
      stderr: stderr.substring(0, 500),
    });
  } catch (scriptError) {
    // If script doesn't exist or fails, use basic fallback
    if (scriptError.code === 'ENOENT') {
      await log('warn', 'Deploy script not found, using basic fallback', { deployScript });
    } else {
      await log('error', 'Deploy script failed, using basic fallback', { 
        error: scriptError.message,
        deployScript 
      });
    }
    
    // Ultimate fallback: basic commands (should rarely be needed)
    const commands = [
      `cd ${APP_PATH}`,
      'git fetch origin',
      'git reset --hard origin/main',
      // Use --no-frozen-lockfile because lockfile is in .gitignore
      'npx pnpm install --no-frozen-lockfile',
      'npx pnpm run db:generate',
      'npx pnpm run db:migrate',
      'export NODE_OPTIONS=--max-old-space-size=4096',
      'npm run build',
      `npx pm2 restart ${PM2_APP_NAME} || npx pm2 start dist/index.js --name ${PM2_APP_NAME}`,
      'npx pm2 save',
    ].join(' && ');
    
    try {
      const { stdout, stderr } = await execAsync(commands, {
        cwd: APP_PATH,
        maxBuffer: 10 * 1024 * 1024,
      });
      
      await log('info', 'Deployment completed (basic fallback)', {
        stdout: stdout.substring(0, 500),
        stderr: stderr.substring(0, 500),
      });
    } catch (error) {
    try {
      await log('error', 'Deployment failed', {
        error: error.message,
        stack: error.stack,
      });
    } catch (logError) {
      // If logging fails, at least log to console
      console.error('Deployment failed:', error);
      console.error('Also failed to log error:', logError);
    }
    // Don't throw - we don't want deployment errors to crash the webhook listener
  }
}

// Error handler for Express
app.use(async (error, req, res, next) => {
  console.error('Express Error:', error);
  try {
    await log('error', 'Express error', {
      error: error.message,
      stack: error.stack,
      path: req.path,
    });
  } catch (logError) {
    // If logging fails, continue anyway
    console.error('Failed to log Express error:', logError);
  }
  
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server
const server = app.listen(PORT, () => {
  serverStarted = true;
  console.log(`🚀 Webhook listener started on port ${PORT}`);
  console.log(`📝 Logs: ${WEBHOOK_LOG}`);
  console.log(`✅ Webhook secret configured and signature verification enabled`);
});

// Handle server errors
server.on('error', async (error) => {
  console.error('❌ Server error:', error);
  try {
    await log('error', 'Server error', {
      error: error.message,
      stack: error.stack,
      code: error.code,
    });
  } catch (logError) {
    console.error('Failed to log server error:', logError);
  }
  
  // Don't exit - let PM2 handle restarts
  // But log the error
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});
