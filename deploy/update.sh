#!/bin/bash
# Installs production packages and restarts Petalpace on the VM.
# The frontend is built on your computer, because a small VM can't build it.
# deploy/upload.ps1 runs this for you. Usage: sudo bash deploy/update.sh

set -e
cd /opt/petalpace

if [ ! -f dist/index.html ]; then
  echo "dist/ is missing. Run deploy/upload.ps1 from your computer first."
  exit 1
fi

if [ -f /var/lib/petalpace/accounts.sqlite ]; then
  bash deploy/backup.sh
fi

npm ci --omit=dev

if systemctl list-unit-files petalpace.service | grep -q petalpace; then
  systemctl restart petalpace
  sleep 2
  systemctl status petalpace --no-pager
  echo "=== Update complete. Petalpace is running the new version. ==="
else
  echo "=== Files are ready. Now create .env.local and run deploy/configure.sh ==="
fi
