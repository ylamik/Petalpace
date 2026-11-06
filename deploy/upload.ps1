# Builds Petalpace and sends it to your server (Vultr, or any Ubuntu VPS) from Windows.
# Your user data on the VM is never touched.
# Usage, from the project folder:
#   .\deploy\upload.ps1 -VmIp YOUR_SERVER_IP

param(
  [Parameter(Mandatory = $true)][string]$VmIp,
  [string]$SshKey = "$env:USERPROFILE\.ssh\petalpace_key",
  [string]$SshUser = "root"
)

$ErrorActionPreference = "Stop"
$target = "$SshUser@$VmIp"
$archive = Join-Path $env:TEMP "petalpace-upload.tgz"

function Invoke-Checked([string]$Label, [scriptblock]$Command) {
  Write-Host "=== $Label ==="
  & $Command
  if ($LASTEXITCODE -ne 0) { throw "$Label failed." }
}

Invoke-Checked "Building Petalpace" { npm run build }

Invoke-Checked "Packing files" {
  tar --exclude=node_modules --exclude=.git --exclude=server/data --exclude=.env.local --exclude=.env.server --exclude=.env --exclude=backups -czf $archive .
}

Invoke-Checked "Uploading" { scp -i $SshKey $archive "${target}:/tmp/petalpace-upload.tgz" }

$remote = @'
set -e
sudo mkdir -p /opt/petalpace
sudo chown -R $(id -un):$(id -gn) /opt/petalpace
rm -rf /opt/petalpace/dist
tar -xzf /tmp/petalpace-upload.tgz -C /opt/petalpace
rm /tmp/petalpace-upload.tgz
cd /opt/petalpace
sed -i 's/\r$//' deploy/*.sh deploy/petalpace.service deploy/nginx.conf
chmod -R a+rX /opt/petalpace
command -v node >/dev/null || sudo bash deploy/setup.sh
sudo chown -R $(id -un):$(id -gn) /opt/petalpace
sudo bash deploy/update.sh
'@

Invoke-Checked "Installing on the VM" { ssh -i $SshKey $target ($remote -replace "`r", "") }

Remove-Item $archive -ErrorAction SilentlyContinue
Write-Host "=== Done ==="
