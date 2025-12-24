# Scripts Directory

Operational scripts for Mantodeus Manager maintenance and automation.

## Available Scripts

### Database Backup (`backup-db.sh`)

Automated database backup with compression, S3 upload, and retention management.

**Features:**
- Creates compressed SQL dumps
- Uploads to S3 (if configured)
- Keeps last 30 backups
- Detailed logging

**Usage:**
```bash
bash scripts/backup-db.sh
```

**Cron setup (daily at 3 AM):**
```bash
0 3 * * * /srv/customer/sites/manager.mantodeus.com/scripts/backup-db.sh >> /srv/customer/sites/manager.mantodeus.com/logs/backup.log 2>&1
```

**Requirements:**
- `mysqldump` command
- `DATABASE_URL` in `.env` file
- Optional: AWS CLI for S3 upload

### Database Restore (`restore-db.sh`)

Restore database from a backup file with safety prompts.

**Features:**
- Interactive confirmation
- Stops application before restore
- Restarts application after restore
- Decompresses gzip backups automatically

**Usage:**
```bash
bash scripts/restore-db.sh <backup-file>
```

**Example:**
```bash
bash scripts/restore-db.sh backups/db/mantodeus-20251223-030000.sql.gz
```

**Safety:**
- Requires typing "yes" to confirm
- Automatically stops PM2 application
- Shows clear warnings before proceeding

## Configuration

All scripts use environment variables from the `.env` file:

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | Database connection string |
| `S3_ENDPOINT` | No | S3-compatible endpoint for backups |
| `S3_BUCKET` | No | S3 bucket name |
| `S3_ACCESS_KEY_ID` | No | S3 access key |
| `S3_SECRET_ACCESS_KEY` | No | S3 secret key |

## Backup Locations

**Local backups:**
```
/srv/customer/sites/manager.mantodeus.com/backups/db/
├── mantodeus-20251223-030000.sql.gz
├── mantodeus-20251224-030000.sql.gz
└── ...
```

**S3 backups (if configured):**
```
s3://mantodeus-manager-files/backups/db/
├── mantodeus-20251223-030000.sql.gz
├── mantodeus-20251224-030000.sql.gz
└── ...
```

## Retention Policy

- **Local**: Last 30 backups
- **S3**: Indefinite (configure S3 lifecycle policy for automatic deletion)

## Troubleshooting

### Backup script fails with "mysqldump: command not found"

Install MySQL client:
```bash
# Debian/Ubuntu
apt-get install mysql-client

# CentOS/RHEL
yum install mysql
```

### S3 upload fails

1. Verify S3 credentials in `.env`
2. Install AWS CLI: `pip install awscli`
3. Test S3 connection:
   ```bash
   aws s3 ls s3://your-bucket --endpoint-url https://your-endpoint
   ```

### Backup file is too large

Database backups are compressed with gzip. Typical compression ratios:
- Text-heavy data: 80-90% reduction
- Binary data: 50-70% reduction

If backups are still too large, consider:
- Excluding large binary tables
- Using incremental backups
- Increasing S3 multipart upload size

## Best Practices

1. **Test restores regularly** - A backup is only good if you can restore from it
2. **Monitor backup logs** - Check `/logs/backup.log` for errors
3. **Verify backup integrity** - Periodically test restore to a test database
4. **Keep off-site backups** - Enable S3 upload for disaster recovery
5. **Document restore procedures** - Ensure team knows how to restore

## See Also

- [Database Guide](../docs/DATABASE.md) - Complete database documentation
- [Deployment Guide](../docs/DEPLOYMENT.md) - Deployment procedures
