# Simple npm install on Server

## The Problem
- SSH disconnects during long `npm install` operations
- Complex scripts hit process limits on shared hosting

## Simple Solution

Just run npm install directly with nohup:

```bash
cd /srv/customer/sites/manager.mantodeus.com

# Simple background install
nohup npm install > npm-install.log 2>&1 &

# Or if you have package-lock.json
nohup npm ci > npm-install.log 2>&1 &
```

Then monitor with:
```bash
tail -f npm-install.log
```

## Even Simpler: Keep Connection Alive

Add to your local `~/.ssh/config` (Windows: `C:\Users\YourName\.ssh\config`):

```
Host 57-105224.ssh.hosting-ik.com
    ServerAliveInterval 60
    ServerAliveCountMax 3
```

Then just run `npm install` normally - the connection won't timeout.

## Your Normal Workflow

```bash
cd /srv/customer/sites/manager.mantodeus.com
npm install
npm run build
pm2 restart mantodeus-manager
```

With SSH keepalive configured, this should work without disconnecting.

