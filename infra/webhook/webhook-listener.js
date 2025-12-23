#!/usr/bin/env node
/**
 * Mantodeus Manager - GitHub Webhook Listener
 * 
 * Automatically deploys on push to main branch
 * 
 * Usage:
 *   pm2 start infra/webhook/webhook-listener.js --name webhook-listener
 * 
 * Environment Variables:
 *   WEBHOOK_SECRET - GitHub webhook secret (required)
 *   WEBHOOK_PORT - Port to listen on (default: 9000)
 *   APP_PATH - Application path (default: /srv/customer/sites/manager.mantodeus.com)
 *   PM2_APP_NAME - PM2 app name (default: mantodeus-manager)
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

// CRITICAL: Fail fast if WEBHOOK_SECRET is not set
if (!SECRET) {
  console.error('❌ FATAL ERROR: WEBHOOK_SECRET environment variable is required for security.');
  console.error('   Set WEBHOOK_SECRET in your environment before starting the webhook listener.');
  console.error('   Generate a secret: openssl rand -hex 32');
  process.exit(1);
}

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
  await log('info', 'Starting deployment', { branch, commitId });
  
  const deployScript = path.join(APP_PATH, 'infra', 'deploy', 'deploy.sh');
  
  try {
    // Check if deploy script exists
    try {
      await fs.access(deployScript);
    } catch {
      await log('error', 'Deploy script not found, using fallback', { deployScript });
      // Fallback: direct commands with retry logic for pnpm install
      // Use --frozen-lockfile to ensure reproducible builds
      const commands = [
        `cd ${APP_PATH}`,
        'git pull origin main',
        `pnpm install --frozen-lockfile || (` +
          `echo "First pnpm install failed, cleaning up..." && ` +
          `rm -rf node_modules && ` +
          `pnpm install --frozen-lockfile` +
        `)`,
        'pnpm build',
        `pm2 restart ${PM2_APP_NAME}`,
      ].join(' && ');
      
      const { stdout, stderr } = await execAsync(commands, {
        cwd: APP_PATH,
        maxBuffer: 10 * 1024 * 1024,
      });
      
      await log('info', 'Deployment completed (fallback)', {
        stdout: stdout.substring(0, 500),
        stderr: stderr.substring(0, 500),
      });
      return;
    }
    
    // Use deploy script
    const { stdout, stderr } = await execAsync(`bash ${deployScript}`, {
      cwd: APP_PATH,
      maxBuffer: 10 * 1024 * 1024,
    });
    
    await log('info', 'Deployment completed', {
      stdout: stdout.substring(0, 500),
      stderr: stderr.substring(0, 500),
    });
  } catch (error) {
    await log('error', 'Deployment failed', {
      error: error.message,
      stack: error.stack,
    });
  }
}

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Webhook listener started on port ${PORT}`);
  console.log(`📝 Logs: ${WEBHOOK_LOG}`);
  console.log(`✅ Webhook secret configured and signature verification enabled`);
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
