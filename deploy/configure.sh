#!/bin/bash
# Run this after uploading the app and creating /opt/petalpace/.env.local.
# Usage: sudo bash configure.sh your-domain your-email

set -e

DOMAIN="${1:?Usage: sudo bash configure.sh your-domain your-email}"
EMAIL="${2:?Usage: sudo bash configure.sh your-domain your-email}"

if [[ "$DOMAIN" =~ ^[0-9.]+$ ]]; then
  echo "Petalpace needs HTTPS in production, which needs a domain, not an IP address."
  exit 1
fi
chmod 600 /opt/petalpace/.env.local

echo "=== Configuring Petalpace for: $DOMAIN ==="

# ── 1. Install nginx site config ────────────────────────────────────
sed "s/YOUR_DOMAIN/$DOMAIN/g" /opt/petalpace/deploy/nginx.conf \
  > /etc/nginx/sites-available/petalpace

ln -sf /etc/nginx/sites-available/petalpace /etc/nginx/sites-enabled/petalpace
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

# ── 3. Install systemd service ───────────────────────────────────────
cp /opt/petalpace/deploy/petalpace.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable petalpace
systemctl start petalpace

echo ""
systemctl status petalpace --no-pager

# ── 4. HTTPS with Let's Encrypt ──
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL"
systemctl reload nginx

echo ""
echo "=== Done! Petalpace is live ==="
echo "Logs: journalctl -u petalpace -f"
echo "Restart: sudo systemctl restart petalpace"
echo "Update:  run deploy\\upload.ps1 from your computer"
