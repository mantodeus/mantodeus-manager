# Infomaniak SSH Key Setup - Complete Guide

## Important: ContainerSSH Detection

Your server is using **ContainerSSH** (visible in verbose output: `Remote software version ContainerSSH`). This may require special setup.

---

## Method 1: Infomaniak Manager (Recommended for ContainerSSH)

Infomaniak's ContainerSSH setup may require adding keys through their control panel:

### Steps:

1. **Log into Infomaniak Manager**
   - Go to: https://manager.infomaniak.com
   - Navigate to your hosting account

2. **Find FTP/SSH Section**
   - Look for "FTP/SSH" or "SSH Access" in your hosting settings
   - Find your SSH account: `M4S5mQQMRhu_mantodeus`

3. **Add SSH Key**
   - Look for "SSH Keys" or "Authorized Keys" section
   - Click "Add SSH Key" or similar
   - Paste your public key:
     ```
     ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAICztYaK5kmG/MVJnkQjMqZt83E5CM4gHjcY2RXOOcs4J mantodeus-manager
     ```
   - Save the changes

4. **Test Connection**
   ```powershell
   ssh mantodeus
   ```

---

## Method 2: Direct authorized_keys (If Method 1 doesn't work)

If Infomaniak Manager doesn't have SSH key management, try adding directly:

### On the Server (after SSHing in with password):

```bash
# 1. Check current setup
echo "Home directory: $HOME"
ls -la ~/.ssh/ 2>/dev/null || echo "No .ssh directory yet"

# 2. Create .ssh directory with correct permissions
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# 3. Add your public key
echo 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAICztYaK5kmG/MVJnkQjMqZt83E5CM4gHjcY2RXOOcs4J mantodeus-manager' >> ~/.ssh/authorized_keys

# 4. Set correct permissions (CRITICAL!)
chmod 600 ~/.ssh/authorized_keys

# 5. Verify
ls -la ~/.ssh/
cat ~/.ssh/authorized_keys
```

### Verify Permissions:

The output should show:
```
drwx------  (700) for ~/.ssh/
-rw-------  (600) for ~/.ssh/authorized_keys
```

---

## Method 3: Check ContainerSSH Configuration

ContainerSSH might have a different authorized_keys location. Check:

```bash
# On the server, check for ContainerSSH config
ls -la ~/.ssh/
ls -la /home/*/.ssh/ 2>/dev/null
cat ~/.ssh/authorized_keys 2>/dev/null

# Check if ContainerSSH uses a different location
env | grep SSH
env | grep AUTHORIZED
```

---

## Troubleshooting

### Key is being offered but rejected

From your verbose output:
```
debug1: Offering public key: ... ED25519 SHA256:oTtndPYAIqj3zszjdoDOZF+xgGiImwzy6R0iIde8RwU
debug1: Authentications that can continue: password,publickey,keyboard-interactive
```

This means:
- ✅ Your key is being sent correctly
- ❌ Server is rejecting it

**Possible causes:**
1. Key not in `authorized_keys` (most likely)
2. Wrong permissions on `authorized_keys` (must be 600)
3. ContainerSSH requires Infomaniak Manager setup
4. Key format issue (extra spaces, line breaks)

### Check Server Logs

On the server, check SSH/auth logs:
```bash
# Try to find auth logs
sudo tail -f /var/log/auth.log 2>/dev/null || \
sudo journalctl -u ssh -f 2>/dev/null || \
sudo journalctl -u sshd -f 2>/dev/null || \
echo "Logs not accessible - may need Infomaniak support"
```

Then try connecting from Windows and watch for rejection messages.

### Verify Key Format

Your key should be ONE line, no line breaks:
```bash
# On server, check the key format
cat ~/.ssh/authorized_keys | wc -l  # Should show number of keys
cat ~/.ssh/authorized_keys | grep -c "ssh-ed25519"  # Should show 1 or more
```

### Test with Explicit Key

From Windows, try:
```powershell
ssh -i C:\Users\Mantodeus\.ssh\id_ed25519 -v mantodeus
```

---

## Alternative: Contact Infomaniak Support

If none of the above works, ContainerSSH on Infomaniak may require:
- Support ticket to enable SSH key authentication
- Special configuration in their control panel
- Different key format or location

**Contact Infomaniak Support:**
- Mention you're using ContainerSSH
- Ask how to add SSH public keys for key-based authentication
- Provide your public key fingerprint: `SHA256:oTtndPYAIqj3zszjdoDOZF+xgGiImwzy6R0iIde8RwU`

---

## Your Current Setup

**Public Key:**
```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAICztYaK5kmG/MVJnkQjMqZt83E5CM4gHjcY2RXOOcs4J mantodeus-manager
```

**Fingerprint:**
```
SHA256:oTtndPYAIqj3zszjdoDOZF+xgGiImwzy6R0iIde8RwU
```

**SSH Config:**
```
Host mantodeus
    HostName 57-105224.ssh.hosting-ik.com
    User M4S5mQQMRhu_mantodeus
    IdentityFile C:/Users/Mantodeus/.ssh/id_ed25519
```

---

## Next Steps

1. **First:** Try Method 1 (Infomaniak Manager) - this is most likely to work with ContainerSSH
2. **If that doesn't exist:** Try Method 2 (direct authorized_keys)
3. **If still failing:** Check Method 3 (ContainerSSH config)
4. **Last resort:** Contact Infomaniak support





