# SSH Connection Troubleshooting for Infomaniak

## Issue: "Connection timed out" or "Could not resolve hostname"

**Diagnosis Results:**
- ✅ Server is reachable (ping succeeds)
- ❌ Port 22 (SSH) is blocked or not enabled
- Server IP: `185.125.27.88`

This means SSH access may need to be enabled in your Infomaniak panel, or Infomaniak uses a different SSH method.

## Solution 1: Use Your Domain Name

Instead of the numeric hostname, try using your actual domain:

```bash
ssh A8wVGN4T1Gt_mantodeus@manager.mantodeus.com
```

## Solution 2: Find Correct SSH Hostname in Infomaniak Panel

1. Log in to your Infomaniak Manager
2. Go to **Hosting** → **SSH Access** or **Server Access**
3. Look for the **SSH Hostname** or **SSH Server** field
4. It might be in a different format, such as:
   - `ssh.infomaniak.com`
   - `[server-id].ssh.infomaniak.com`
   - `[your-domain].com` (direct domain SSH)

## Solution 3: Enable SSH Access in Infomaniak Panel (MOST LIKELY FIX)

**Port 22 is currently blocked/not enabled.** You need to enable SSH access:

1. Log in to **Infomaniak Manager**
2. Go to your **Hosting** account
3. Navigate to **SSH Access** or **Server Access** settings
4. **Enable SSH access** (this may require approval or activation)
5. Check if there's a specific **SSH port** (might not be 22)
6. Verify your SSH username: `A8wVGN4T1Gt_mantodeus`
7. Some Infomaniak plans require SSH to be explicitly enabled - check your plan details

## Solution 4: Try Alternative Formats

Common Infomaniak SSH hostname formats:

```bash
# Format 1: Direct domain
ssh A8wVGN4T1Gt_mantodeus@manager.mantodeus.com

# Format 2: SSH subdomain
ssh A8wVGN4T1Gt_mantodeus@ssh.infomaniak.com

# Format 3: Server-specific
ssh A8wVGN4T1Gt_mantodeus@[server-id].ssh.infomaniak.com

# Format 4: IP address (if you have it)
ssh A8wVGN4T1Gt_mantodeus@[IP_ADDRESS]
```

## Solution 5: Check Your Network/DNS

If DNS resolution is failing:

```powershell
# Flush DNS cache
ipconfig /flushdns

# Try again
ssh A8wVGN4T1Gt_mantodeus@manager.mantodeus.com
```

## Solution 6: Use Infomaniak Web Interface (RECOMMENDED IF SSH IS BLOCKED)

Since port 22 is blocked, use Infomaniak's web interface to manage your application:

### Option A: Environment Variables via Node.js App Settings

1. Log in to **Infomaniak Manager**
2. Go to **Node.js Applications** → `manager.mantodeus.com`
3. Navigate to **Environment Variables** or **Configuration**
4. Add/update these S3 variables:
   ```
   S3_ENDPOINT=https://s3.pub1.infomaniak.cloud
   S3_REGION=us-east-1
   S3_BUCKET=mantodeus-manager-files
   S3_ACCESS_KEY_ID=ba794c9e6d034ccc9ac0bb2d3aa55b1b
   S3_SECRET_ACCESS_KEY=e78e5ef0cebb462faf397ea621b1d87a
   ```
5. **Save** and **Restart** the application

### Option B: File Manager

1. Log in to **Infomaniak Manager**
2. Go to **File Manager**
3. Navigate to your application directory (check Node.js app settings for path)
4. Edit `.env` file directly through the web interface

## Finding Your Application Directory

Your app is likely located at one of these paths:
- `/srv/customer/sites/manager.mantodeus.com`
- `/home/A8wVGN4T1Gt_mantodeus/apps/manager.mantodeus.com`
- Check in Infomaniak Panel → Node.js App → "Application Path"

## Next Steps

Once you can SSH in, you can:
1. Check your `.env` file
2. Update S3 environment variables
3. Restart your application
4. Check logs

## Need Help?

If none of these work:
1. Contact Infomaniak support for your correct SSH hostname
2. Check your Infomaniak Manager dashboard for SSH connection details
3. Use the File Manager as an alternative

