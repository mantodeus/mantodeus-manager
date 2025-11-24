# Mantodeus Manager - Deployment Guide

This guide explains how to deploy the Mantodeus Manager application to your own hosting environment, including WordPress/Infomaniak domain servers.

## Overview

Mantodeus Manager is a full-stack web application built with:
- **Frontend**: React 19 + Tailwind CSS 4 + Vite
- **Backend**: Node.js + Express + tRPC
- **Database**: MySQL/MariaDB compatible
- **Storage**: S3-compatible object storage

## Deployment Options

### Option 1: Deploy with Manus (Recommended)

The easiest way to deploy is using the built-in Manus deployment:

1. Click the **Publish** button in the Manus interface
2. Your application will be deployed with:
   - Automatic SSL certificates
   - Built-in database (MySQL)
   - S3 storage included
   - Custom domain support
3. Access your deployed site at the provided URL
4. Configure a custom domain in Settings → Domains

### Option 2: Self-Hosted Deployment

To deploy on your own infrastructure (VPS, dedicated server, or cloud provider):

#### Prerequisites

- Node.js 22.x or higher
- MySQL 8.0 or MariaDB 10.5+
- S3-compatible storage (AWS S3, MinIO, DigitalOcean Spaces, etc.)
- Domain name with DNS access
- SSL certificate (Let's Encrypt recommended)

#### Step 1: Prepare the Server

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 22.x
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Install pnpm
npm install -g pnpm

# Install MySQL
sudo apt install -y mysql-server
sudo mysql_secure_installation
```

#### Step 2: Set Up Database

```bash
# Connect to MySQL
sudo mysql -u root -p

# Create database and user
CREATE DATABASE mantodeus_manager;
CREATE USER 'mantodeus_user'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON mantodeus_manager.* TO 'mantodeus_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

#### Step 3: Configure Environment Variables

Create a `.env` file in the project root:

```env
# Database Configuration
DATABASE_URL=mysql://mantodeus_user:your_secure_password@localhost:3306/mantodeus_manager

# JWT Secret (generate a random string)
JWT_SECRET=your_random_jwt_secret_here

# OAuth Configuration (if using Manus OAuth)
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://portal.manus.im
VITE_APP_ID=your_app_id

# Application Configuration
VITE_APP_TITLE=Mantodeus Manager
VITE_APP_LOGO=/logo.png

# S3 Storage Configuration
S3_ENDPOINT=your-s3-endpoint
S3_REGION=us-east-1
S3_BUCKET=mantodeus-manager-files
S3_ACCESS_KEY_ID=your_access_key
S3_SECRET_ACCESS_KEY=your_secret_key

# Owner Information
OWNER_OPEN_ID=your_owner_open_id
OWNER_NAME=Your Name

# Server Configuration
PORT=3000
NODE_ENV=production
```

#### Step 4: Deploy Application Files

```bash
# Clone or upload your application files
cd /var/www/mantodeus-manager

# Install dependencies
pnpm install --prod

# Run database migrations
pnpm db:push

# Build the application
pnpm build

# Start the server with PM2 (process manager)
sudo npm install -g pm2
pm2 start npm --name "mantodeus-manager" -- start
pm2 save
pm2 startup
```

#### Step 5: Configure Nginx Reverse Proxy

Create `/etc/nginx/sites-available/mantodeus-manager`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site and restart Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/mantodeus-manager /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### Step 6: Set Up SSL with Let's Encrypt

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### Option 3: WordPress/Infomaniak Hosting

**Important Note**: WordPress hosting is designed for WordPress sites. To host this Node.js application, you need:

1. **Upgrade to VPS/Cloud Hosting**: Contact Infomaniak to upgrade from shared WordPress hosting to a VPS or cloud instance where you have full server access.

2. **Use Subdomain with Separate Server**: Deploy the application on a separate server (VPS, cloud provider) and point a subdomain to it:
   - Main site: `yoursite.com` (WordPress)
   - App: `app.yoursite.com` (Mantodeus Manager on separate server)

3. **Alternative - Use Manus Hosting**: Deploy with Manus and configure custom domain:
   - Deploy via Manus Publish button
   - In Manus Settings → Domains, add your custom domain
   - Update DNS records as instructed
   - Your app will be accessible at your custom domain

## Post-Deployment Configuration

### 1. Create Admin User

After deployment, log in with your OAuth credentials. The first user with the `OWNER_OPEN_ID` will automatically be assigned admin role.

### 2. Configure S3 Storage

Ensure your S3 bucket has the correct CORS configuration:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": ["https://your-domain.com"],
    "ExposeHeaders": ["ETag"]
  }
]
```

### 3. Set Up Backups

```bash
# Database backup script
mysqldump -u mantodeus_user -p mantodeus_manager > backup_$(date +%Y%m%d).sql

# Set up automated daily backups with cron
0 2 * * * /path/to/backup-script.sh
```

### 4. Monitor Application

```bash
# View application logs
pm2 logs mantodeus-manager

# Monitor resource usage
pm2 monit

# Restart application
pm2 restart mantodeus-manager
```

## Updating the Application

```bash
# Pull latest changes
cd /var/www/mantodeus-manager
git pull origin main

# Install dependencies
pnpm install

# Run migrations
pnpm db:push

# Rebuild
pnpm build

# Restart
pm2 restart mantodeus-manager
```

## Troubleshooting

### Database Connection Issues

- Verify DATABASE_URL is correct
- Check MySQL is running: `sudo systemctl status mysql`
- Ensure user has proper permissions

### File Upload Issues

- Verify S3 credentials and bucket permissions
- Check CORS configuration
- Ensure bucket is publicly accessible for read operations

### Application Won't Start

- Check logs: `pm2 logs mantodeus-manager`
- Verify all environment variables are set
- Ensure port 3000 is not already in use

## Security Recommendations

1. **Use strong passwords** for database and admin accounts
2. **Keep dependencies updated**: Run `pnpm update` regularly
3. **Enable firewall**: Only allow necessary ports (80, 443, 22)
4. **Regular backups**: Automate database and file backups
5. **Monitor logs**: Set up log monitoring and alerts
6. **Use HTTPS**: Always use SSL certificates in production

## Support

For deployment assistance or issues:
- Check the application logs
- Review environment variable configuration
- Ensure all prerequisites are met
- Contact your hosting provider for server-specific issues

## License

This application is provided as-is for your use. Modify and deploy as needed for your organization.
