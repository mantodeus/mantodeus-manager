# Deployment Steps After Committing

## 📋 Complete Deployment Process

After you commit and push to GitHub, you need to:

### Step 1: Pull Changes on Server ✅
```bash
ssh your-username@your-server
cd /srv/customer/sites/manager.mantodeus.com
git pull origin main
```

### Step 2: Rebuild Application ✅
```bash
npm run build
```

### Step 3: Restart App (PM2) ✅
```bash
npx pm2 restart mantodeus-manager
```

## 🚀 Quick Method: Use the Deploy Script

**First time setup** - Copy `deploy-server.sh` to your server:

```bash
# On your server
cd /srv/customer/sites/manager.mantodeus.com
# Copy the deploy-server.sh file here (or create it)
chmod +x deploy-server.sh
```

**Then every time you push:**
```bash
ssh your-username@your-server
cd /srv/customer/sites/manager.mantodeus.com
./deploy-server.sh
```

## ⚡ One-Liner (After Setup)

```bash
ssh your-username@your-server "cd /srv/customer/sites/manager.mantodeus.com && ./deploy-server.sh"
```

## 🔄 Why Restart is Needed

The running Node.js process (managed by PM2) runs the built code from `dist/index.js`. When you:
1. Pull new code → Code changes
2. Build → Creates new `dist/index.js`
3. **Restart** → App loads the new `dist/index.js`

Without restarting, the app is still running the old code!

## 💡 Pro Tip

Use `bash infra/production/deploy-production.sh` on the server to do pull/build/restart in one command (and wire it into GitHub Actions/webhooks if you want full automation).

