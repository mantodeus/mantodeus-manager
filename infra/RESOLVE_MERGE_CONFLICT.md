# Resolve Merge Conflict on Server

You have a merge conflict that needs to be resolved before you can checkout the branch.

## Quick Solution: Abort Merge and Checkout

If the merge conflict is not important, abort it:

```bash
cd /srv/customer/sites/manager.mantodeus.com
git merge --abort
git checkout cursor/git-repository-cleanup-and-repair-composer-1-5507
```

## Alternative: Resolve the Conflict

If you need to keep the merge:

```bash
cd /srv/customer/sites/manager.mantodeus.com

# Check status
git status

# The conflict is in: drizzle/meta/_journal.json
# Option 1: Accept the incoming version (from the branch you're merging)
git checkout --theirs drizzle/meta/_journal.json
git add drizzle/meta/_journal.json
git commit -m "Resolve merge conflict in drizzle journal"

# Option 2: Accept your current version
git checkout --ours drizzle/meta/_journal.json
git add drizzle/meta/_journal.json
git commit -m "Resolve merge conflict in drizzle journal"

# Then checkout the branch
git checkout cursor/git-repository-cleanup-and-repair-composer-1-5507
```

## Simplest: Just Copy Infra Directory

If you just need the infra directory and don't care about the merge:

```bash
cd /srv/customer/sites/manager.mantodeus.com
git merge --abort
git checkout cursor/git-repository-cleanup-and-repair-composer-1-5507
ls -la infra/
```
