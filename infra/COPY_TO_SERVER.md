# Copy Infrastructure to Server

## Option 1: Using SCP (from your local machine)

From your local machine, run:

```bash
scp -r infra/ M4S5mQQMRhu_mantodeus@57-105224.ssh.hosting-ik.com:/srv/customer/sites/manager.mantodeus.com/
```

Or if you've configured SSH:

```bash
scp -r infra/ mantodeus-server:/srv/customer/sites/manager.mantodeus.com/
```

## Option 2: Using Git Pull (on the server)

If the infra directory is committed to your repository, on the server run:

```bash
cd /srv/customer/sites/manager.mantodeus.com
git pull origin main
# or
git pull origin cursor/git-repository-cleanup-and-repair-composer-1-5507
```

## Option 3: Manual Copy (if you have file access)

If you have direct file access to the server, copy the entire `infra/` directory.

## After Copying

Once the infra directory is on the server, make scripts executable:

```bash
cd /srv/customer/sites/manager.mantodeus.com
chmod +x infra/deploy/*.sh
chmod +x infra/ssh/*.sh
chmod +x infra/env/*.sh
chmod +x infra/tests/*.sh
chmod +x infra/webhook/*.js
```

## Verify

```bash
ls -la infra/
./infra/deploy/status.sh
```
