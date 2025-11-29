# Install PM2 on Your Server

PM2 is not found. Here's how to install it:

## Option 1: Install PM2 Globally (Recommended)

```bash
# Install PM2 globally
npm install -g pm2

# Verify installation
pm2 --version

# Now you can start the webhook server
cd ~/sites/manager.mantodeus.com/deploy
pm2 start deploy.js --name github-webhook
pm2 save
```

## Option 2: Check if PM2 is Already Installed Elsewhere

```bash
# Check if PM2 exists in common locations
which pm2
whereis pm2

# Check if it's in node_modules
find ~ -name "pm2" -type f 2>/dev/null

# Check if it's available via npx
npx pm2 --version
```

## Option 3: Use npx (No Installation Needed)

```bash
cd ~/sites/manager.mantodeus.com/deploy
npx pm2 start deploy.js --name github-webhook
npx pm2 save
```

## Option 4: Run Without PM2 (Temporary)

If you just want to test, you can run it directly:

```bash
cd ~/sites/manager.mantodeus.com/deploy
node deploy.js
```

**Note:** This will run in the foreground. Press Ctrl+C to stop. For production, use PM2 or a process manager.

## Option 5: Use screen (Alternative Process Manager)

```bash
# Install screen (if not installed)
sudo apt-get install screen  # or yum install screen

# Start webhook server in screen
cd ~/sites/manager.mantodeus.com/deploy
screen -S github-webhook
node deploy.js
# Press Ctrl+A then D to detach

# To reattach later
screen -r github-webhook
```

## Recommended: Install PM2

```bash
# Install Node.js if not installed (PM2 requires Node.js)
node --version

# Install PM2 globally
npm install -g pm2

# Verify
pm2 --version

# Start webhook server
cd ~/sites/manager.mantodeus.com/deploy
pm2 start deploy.js --name github-webhook
pm2 save
pm2 startup  # Optional: start PM2 on server boot
```

---

**Quick check:** Run `node --version` first to make sure Node.js is installed.

