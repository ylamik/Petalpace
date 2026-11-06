#!/bin/bash
# Upload Petalpace to your Oracle Cloud VM from your local machine.
# Usage: bash deploy/upload.sh YOUR_VM_IP
# Example: bash deploy/upload.sh 140.238.12.34
#
# Prerequisites:
#   - You have the SSH private key from Oracle Cloud (downloaded when creating the VM)
#   - Save it as ~/.ssh/petalpace_key and run: chmod 600 ~/.ssh/petalpace_key

set -e

VM_IP="${1:?Usage: bash deploy/upload.sh YOUR_VM_IP}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/petalpace_key}"
SSH_USER="ubuntu"   # Oracle Cloud Ubuntu VMs use 'ubuntu' as the default user
REMOTE_DIR="/opt/petalpace"

echo "=== Building Petalpace for production ==="
npm run build

echo ""
echo "=== Uploading to $VM_IP ==="

# Create the remote directory
ssh -i "$SSH_KEY" "$SSH_USER@$VM_IP" "sudo mkdir -p $REMOTE_DIR && sudo chown $SSH_USER:$SSH_USER $REMOTE_DIR"

# Upload all files except node_modules, .git, and local data
rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude 'server/data' \
  --exclude '.env.local' \
  --exclude '.env.server' \
  --exclude 'dist' \
  . "$SSH_USER@$VM_IP:$REMOTE_DIR/" \
  -e "ssh -i $SSH_KEY"

# Upload the built frontend
rsync -avz --progress \
  dist/ "$SSH_USER@$VM_IP:$REMOTE_DIR/dist/" \
  -e "ssh -i $SSH_KEY"

echo ""
echo "=== Installing dependencies on server ==="
ssh -i "$SSH_KEY" "$SSH_USER@$VM_IP" "cd $REMOTE_DIR && npm ci --omit=dev"

echo ""
echo "=== Upload complete ==="
echo ""
echo "Next: SSH into your VM and run:"
echo "  ssh -i $SSH_KEY $SSH_USER@$VM_IP"
echo "  sudo nano /opt/petalpace/.env.local   # add your env vars"
echo "  sudo bash /opt/petalpace/deploy/configure.sh $VM_IP"
