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

### Step 3: Restart App in Infomaniak Panel ✅
- Go to Infomaniak Manager
- Navigate to your Node.js app
- Click **"Restart"** or **"Redeploy"**

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
# Then restart in Infomaniak panel
```

## ⚡ One-Liner (After Setup)

```bash
ssh your-username@your-server "cd /srv/customer/sites/manager.mantodeus.com && ./deploy-server.sh"
# Then restart in Infomaniak panel
```

## 🔄 Why Restart is Needed

The Infomaniak Node.js app runs the built code from `dist/index.js`. When you:
1. Pull new code → Code changes
2. Build → Creates new `dist/index.js`
3. **Restart** → App loads the new `dist/index.js`

Without restarting, the app is still running the old code!

## 💡 Pro Tip

Set up a **GitHub webhook** or use **GitHub Actions** (see `AUTO_DEPLOY.md`) to automate steps 1-2. You'll still need to restart manually in Infomaniak, OR set up PM2 on the server to auto-restart.

