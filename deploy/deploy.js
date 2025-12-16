import express from 'express';
import { exec } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load configuration
const configPath = path.join(__dirname, 'deploy.config.json');
let config = {};

try {
  const configFile = fs.readFileSync(configPath, 'utf8');
  config = JSON.parse(configFile);
} catch (err) {
  console.error('Warning: Could not load deploy.config.json, using defaults');
  config = {
    secret: process.env.WEBHOOK_SECRET || 'YOUR_WEBHOOK_SECRET',
    appPath: process.env.APP_PATH || '/path/to/your/app',
    pm2AppName: process.env.PM2_APP_NAME || 'mantodeus',
    port: process.env.WEBHOOK_PORT || 9000,
    usePnpm: process.env.USE_PNPM === 'true' || false,
    logFile: process.env.LOG_FILE || path.join(__dirname, 'deploy.log')
  };
}

const app = express();
app.use(express.json());

const SECRET = config.secret;
const APP_PATH = config.appPath;
const PM2_APP_NAME = config.pm2AppName;
const PORT = config.port;
const USE_PNPM = config.usePnpm;
const LOG_FILE = config.logFile;

// Ensure log directory exists
const logDir = path.dirname(LOG_FILE);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Logging function
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}\n`;
  console.log(logMessage.trim());
  
  try {
    fs.appendFileSync(LOG_FILE, logMessage);
  } catch (err) {
    console.error('Failed to write to log file:', err);
  }
}

// Verify GitHub webhook signature
function verifyGitHubSignature(req) {
  const signature = req.headers['x-hub-signature-256'];
  
  if (!signature) {
    log('Missing signature header', 'WARN');
    return false;
  }

  const body = JSON.stringify(req.body);
  const hmac = crypto.createHmac('sha256', SECRET);
  hmac.update(body);
  const digest = `sha256=${hmac.digest('hex')}`;
  
  const isValid = signature === digest;
  
  if (!isValid) {
    log('Invalid signature - potential security issue!', 'ERROR');
  }
  
  return isValid;
}

// Deployment function
function deploy() {
  return new Promise((resolve, reject) => {
    log('Starting deployment...');
    
    // Use the proper deployment script that handles node_modules cleanup
    // This fixes issues with corrupted optional dependencies (e.g., Tailwind CSS)
    const deployScript = path.join(APP_PATH, 'infra/production/deploy-production.sh');
    
    // Check if deployment script exists, otherwise fall back to manual commands
    const useDeployScript = fs.existsSync(deployScript);
    
    let fullCommand;
    if (useDeployScript) {
      log('Using deployment script: infra/production/deploy-production.sh');
      fullCommand = `cd ${APP_PATH} && bash infra/production/deploy-production.sh`;
    } else {
      log('Deployment script not found, using manual commands');
      const packageManager = USE_PNPM ? 'pnpm' : 'npm';
      const installCmd = USE_PNPM ? 'pnpm install' : 'npm install --legacy-peer-deps --no-audit --no-fund --include=dev';
      const buildCmd = USE_PNPM ? 'pnpm build' : 'npm run build';
      
      // Clean node_modules if it exists to avoid corrupted dependency issues
      const commands = [
        `cd ${APP_PATH}`,
        'git pull',
        '[ -d node_modules ] && rm -rf node_modules || true',
        installCmd,
        buildCmd,
        `npx pm2 restart ${PM2_APP_NAME}`
      ];
      
      fullCommand = commands.join(' && ');
    }
    
    log(`Executing: ${fullCommand}`);
    
    exec(fullCommand, { 
      cwd: APP_PATH,
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer for large outputs
    }, (err, stdout, stderr) => {
      if (err) {
        log(`Deployment error: ${err.message}`, 'ERROR');
        log(`stderr: ${stderr}`, 'ERROR');
        return reject(err);
      }
      
      log('Deployment successful!');
      log(`stdout: ${stdout}`);
      
      if (stderr) {
        log(`stderr: ${stderr}`, 'WARN');
      }
      
      resolve({ stdout, stderr });
    });
  });
}

// Webhook endpoint
app.post('/github-webhook', async (req, res) => {
  try {
    // Verify signature
    if (!verifyGitHubSignature(req)) {
      log('Unauthorized webhook attempt', 'ERROR');
      return res.status(401).send('Invalid signature');
    }

    // Check if this is a push event
    const event = req.headers['x-github-event'];
    const ref = req.body.ref;
    
    log(`Webhook received - Event: ${event}, Ref: ${ref}`);
    
    // Only deploy on push to main/master branch
    if (event === 'push' && (ref === 'refs/heads/main' || ref === 'refs/heads/master')) {
      log('Push to main/master detected, starting deployment...');
      
      // Send immediate response to GitHub
      res.status(200).send('Deployment started');
      
      // Deploy asynchronously
      deploy()
        .then(() => {
          log('Deployment completed successfully', 'SUCCESS');
        })
        .catch((err) => {
          log(`Deployment failed: ${err.message}`, 'ERROR');
        });
    } else {
      log(`Ignoring event: ${event} on ref: ${ref}`);
      res.status(200).send('Event received but not a push to main/master');
    }
  } catch (error) {
    log(`Error processing webhook: ${error.message}`, 'ERROR');
    res.status(500).send('Internal server error');
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    config: {
      appPath: APP_PATH,
      pm2AppName: PM2_APP_NAME,
      usePnpm: USE_PNPM
    }
  });
});

// Start server
app.listen(PORT, () => {
  log(`Webhook listener running on port ${PORT}`);
  log(`App path: ${APP_PATH}`);
  log(`PM2 app name: ${PM2_APP_NAME}`);
  log(`Using ${USE_PNPM ? 'pnpm' : 'npm'}`);
  log(`Log file: ${LOG_FILE}`);
});

