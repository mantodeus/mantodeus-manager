# Auto-Deployment Setup

This guide explains how to automatically deploy changes to your Infomaniak server.

## 🚀 Quick Deploy (Manual)

**Easiest option** - Run this script after making changes:

```powershell
.\quick-deploy.ps1
```

This will:
1. Add all changes
2. Commit with timestamp
3. Push to GitHub
4. Show you the SSH commands to run on server

## 👀 Auto-Deploy on File Save

**For instant deployment** - Run this and it watches for file changes:

```powershell
.\watch-and-deploy.ps1
```

This will:
- Watch for any file changes in the project
- Wait 2 seconds after last change (debounce)
- Automatically commit and push to GitHub
- You still need to run `git pull && npm run build` on server

**To stop:** Press `Ctrl+C`

## ⚙️ Using VS Code/Cursor Tasks

1. Press `Ctrl+Shift+P` (Command Palette)
2. Type "Tasks: Run Task"
3. Select:
   - **"Quick Deploy"** - One-time deployment
   - **"Watch and Auto-Deploy"** - Continuous watching

## 🔄 Full Auto-Deploy (GitHub Actions)

For **completely automatic** deployment (no manual steps):

### Setup GitHub Actions (One-time):

1. Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions**

2. Add these secrets:
   - `INFOMANIAK_HOST` - Your server hostname
   - `INFOMANIAK_USER` - Your SSH username
   - `INFOMANIAK_SSH_KEY` - Your private SSH key

3. Push the `.github/workflows/deploy.yml` file to GitHub

4. Now every `git push` will automatically:
   - Build the app
   - Deploy to your server
   - Restart the app

### Get your SSH key:

```bash
# On your server, if you don't have a key:
ssh-keygen -t ed25519 -C "github-actions"
cat ~/.ssh/id_ed25519.pub >> ~/.ssh/authorized_keys

# Copy the private key (id_ed25519) to GitHub Secrets
```

## 📋 Server-Side Auto-Deploy Script

Create this on your server at `/srv/customer/sites/manager.mantodeus.com/deploy.sh`:

```bash
#!/bin/bash
cd /srv/customer/sites/manager.mantodeus.com
git pull origin main
npm install
npm run build
# Add restart command if needed
```

Make it executable:
```bash
chmod +x deploy.sh
```

Then you can just run `./deploy.sh` after pulling changes.

## 🎯 Recommended Workflow

**For active development:**

1. **Option A: Use the watcher**
   ```powershell
   .\watch-and-deploy.ps1
   ```
   Then in another terminal, SSH to server and run:
   ```bash
   watch -n 5 'cd /srv/customer/sites/manager.mantodeus.com && git pull && npm run build'
   ```

2. **Option B: Use GitHub Actions**
   - Set up once (see above)
   - Just `git push` and it auto-deploys!

3. **Option C: Manual but fast**
   - Use `quick-deploy.ps1` after changes
   - SSH and run deploy commands

## 🔧 Troubleshooting

**Git not found:**
- The scripts use the GitHub Desktop git path
- If you have git elsewhere, update the path in the scripts

**SSH connection issues:**
- Make sure your SSH key is set up
- Test with: `ssh your-username@your-server`

**Build fails on server:**
- Check server logs in Infomaniak panel
- Verify `.env` file exists on server
- Check Node.js version matches (should be 24.x)

