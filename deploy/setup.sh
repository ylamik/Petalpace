#!/bin/bash
# Petalpace — Oracle Cloud Ubuntu setup script
# Run this once on a fresh Ubuntu 22.04 or 24.04 VM as root or with sudo.
# Usage: sudo bash setup.sh

set -e

echo "=== Petalpace server setup ==="

# ── 1. System packages ──────────────────────────────────────────────
apt-get update -y
export DEBIAN_FRONTEND=noninteractive
apt-get install -y curl nginx certbot python3-certbot-nginx sqlite3 iptables-persistent

# ── 2. Node.js 24 ──
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt-get install -y nodejs

echo "Node version: $(node --version)"
echo "npm version:  $(npm --version)"

# ── 3. Create app user ───────────────────────────────────────────────
id -u petalpace &>/dev/null || useradd -m -s /bin/bash petalpace

# ── 4. App and data directories ──
# Data lives outside the app folder, so uploads can never touch it.
mkdir -p /opt/petalpace /var/lib/petalpace /var/backups/petalpace
chown petalpace:petalpace /var/lib/petalpace
chmod 700 /var/lib/petalpace /var/backups/petalpace

# ── 5. Oracle's Ubuntu images block web traffic inside the VM too ──
iptables -I INPUT 1 -p tcp --dport 80 -j ACCEPT
iptables -I INPUT 2 -p tcp --dport 443 -j ACCEPT
netfilter-persistent save

# ── 6. Swap, so a small VM survives memory spikes ──
if [ ! -f /swapfile ] && [ "$(free -m | awk '/^Mem:/{print $2}')" -lt 2048 ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo ""
echo "=== Setup complete ==="
