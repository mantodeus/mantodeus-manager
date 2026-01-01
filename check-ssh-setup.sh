#!/bin/bash
# Run this ON THE SERVER to diagnose SSH key setup
# Usage: After SSHing in, run: bash check-ssh-setup.sh

echo "=== SSH Key Setup Diagnostic ==="
echo ""

# Check home directory
echo "1. Home Directory:"
echo "   $HOME"
echo ""

# Check .ssh directory
echo "2. .ssh Directory:"
if [ -d ~/.ssh ]; then
    echo "   ✅ Exists"
    ls -ld ~/.ssh
    echo ""
    echo "   Contents:"
    ls -la ~/.ssh/
else
    echo "   ❌ Does NOT exist"
fi
echo ""

# Check authorized_keys
echo "3. authorized_keys File:"
if [ -f ~/.ssh/authorized_keys ]; then
    echo "   ✅ Exists"
    ls -l ~/.ssh/authorized_keys
    echo ""
    echo "   File size: $(wc -c < ~/.ssh/authorized_keys) bytes"
    echo "   Number of keys: $(grep -c "^ssh-" ~/.ssh/authorized_keys 2>/dev/null || echo 0)"
    echo ""
    echo "   Contents:"
    cat ~/.ssh/authorized_keys
    echo ""
    echo "   Looking for your key (SHA256:oTtndPYAIqj3zszjdoDOZF+xgGiImwzy6R0iIde8RwU):"
    if grep -q "oTtndPYAIqj3zszjdoDOZF+xgGiImwzy6R0iIde8RwU" ~/.ssh/authorized_keys 2>/dev/null; then
        echo "   ✅ YOUR KEY IS FOUND!"
    else
        echo "   ❌ YOUR KEY IS NOT FOUND"
    fi
else
    echo "   ❌ Does NOT exist"
fi
echo ""

# Check permissions
echo "4. Permissions Check:"
if [ -d ~/.ssh ]; then
    PERM=$(stat -c "%a" ~/.ssh 2>/dev/null || stat -f "%OLp" ~/.ssh 2>/dev/null)
    if [ "$PERM" = "700" ]; then
        echo "   ✅ .ssh directory: $PERM (correct)"
    else
        echo "   ⚠️  .ssh directory: $PERM (should be 700)"
    fi
fi

if [ -f ~/.ssh/authorized_keys ]; then
    PERM=$(stat -c "%a" ~/.ssh/authorized_keys 2>/dev/null || stat -f "%OLp" ~/.ssh/authorized_keys 2>/dev/null)
    if [ "$PERM" = "600" ]; then
        echo "   ✅ authorized_keys: $PERM (correct)"
    else
        echo "   ⚠️  authorized_keys: $PERM (should be 600)"
    fi
fi
echo ""

# Check for ContainerSSH
echo "5. ContainerSSH Detection:"
if [ -n "$(which sshd 2>/dev/null)" ]; then
    SSHD_VERSION=$(sshd -V 2>&1 | head -1)
    echo "   SSH daemon: $SSHD_VERSION"
fi

# Check environment
echo "6. Environment Variables:"
env | grep -i ssh | head -5
env | grep -i authorized | head -5
echo ""

# Check for alternative key locations
echo "7. Alternative Key Locations:"
if [ -f /etc/ssh/authorized_keys ]; then
    echo "   Found: /etc/ssh/authorized_keys"
fi
if [ -f ~/.ssh/authorized_keys2 ]; then
    echo "   Found: ~/.ssh/authorized_keys2"
fi
echo ""

echo "=== Summary ==="
echo ""
if [ -f ~/.ssh/authorized_keys ] && grep -q "oTtndPYAIqj3zszjdoDOZF+xgGiImwzy6R0iIde8RwU" ~/.ssh/authorized_keys 2>/dev/null; then
    echo "✅ Key is in authorized_keys"
    if [ -d ~/.ssh ] && [ "$(stat -c "%a" ~/.ssh 2>/dev/null || stat -f "%OLp" ~/.ssh 2>/dev/null)" = "700" ] && \
       [ -f ~/.ssh/authorized_keys ] && [ "$(stat -c "%a" ~/.ssh/authorized_keys 2>/dev/null || stat -f "%OLp" ~/.ssh/authorized_keys 2>/dev/null)" = "600" ]; then
        echo "✅ Permissions are correct"
        echo ""
        echo "⚠️  If SSH still asks for password, ContainerSSH may require:"
        echo "   1. Adding key through Infomaniak Manager"
        echo "   2. Contacting Infomaniak support"
    else
        echo "⚠️  Permissions need to be fixed"
        echo "   Run: chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys"
    fi
else
    echo "❌ Key is NOT in authorized_keys"
    echo ""
    echo "To add it, run:"
    echo "  echo 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAICztYaK5kmG/MVJnkQjMqZt83E5CM4gHjcY2RXOOcs4J mantodeus-manager' >> ~/.ssh/authorized_keys"
    echo "  chmod 600 ~/.ssh/authorized_keys"
fi
echo ""





