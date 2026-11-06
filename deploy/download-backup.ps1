# Copies the newest database backup from the VM to this computer.
# It holds every user's data, so keep the folder private and out of Git.
# Usage: .\deploy\download-backup.ps1 -VmIp YOUR_SERVER_IP

param(
  [Parameter(Mandatory = $true)][string]$VmIp,
  [string]$SshKey = "$env:USERPROFILE\.ssh\petalpace_key",
  [string]$SshUser = "root",
  [string]$Folder = "$env:USERPROFILE\PetalpaceBackups"
)

$ErrorActionPreference = "Stop"
$target = "$SshUser@$VmIp"
New-Item -ItemType Directory -Force -Path $Folder | Out-Null

$prepare = 'set -e; sudo bash /opt/petalpace/deploy/backup.sh >/dev/null; newest=$(sudo ls -t /var/backups/petalpace/ | head -1); sudo cp "/var/backups/petalpace/$newest" /tmp/petalpace-backup.sqlite; sudo chown $(id -un) /tmp/petalpace-backup.sqlite; chmod 600 /tmp/petalpace-backup.sqlite'
ssh -i $SshKey $target $prepare
if ($LASTEXITCODE -ne 0) { throw "Could not prepare the backup." }

$file = Join-Path $Folder ("accounts_" + (Get-Date -Format "yyyy-MM-dd_HH-mm") + ".sqlite")
scp -i $SshKey "${target}:/tmp/petalpace-backup.sqlite" $file
$copied = $LASTEXITCODE
ssh -i $SshKey $target "rm -f /tmp/petalpace-backup.sqlite"
if ($copied -ne 0) { throw "Could not download the backup." }

Get-ChildItem $Folder -Filter "accounts_*.sqlite" | Sort-Object LastWriteTime -Descending | Select-Object -Skip 14 | Remove-Item
Write-Host "Backup saved: $file"
