# Deploying Petalpace on a Vultr server

This is how Petalpace runs live at **https://petalpace.duckdns.org**: one small Ubuntu server on Vultr, a free Duck DNS address, free HTTPS from Let's Encrypt, and email through Gmail.

| Piece | What we use | Cost |
|---|---|---|
| Server | Vultr Cloud Compute, 1 vCPU / 1 GB RAM / 25 GB, Singapore, Ubuntu | about $5 a month (prepaid credit) |
| Address | Duck DNS (`petalpace.duckdns.org`) | free |
| HTTPS | Let's Encrypt via certbot | free |
| Email | Gmail app password over SMTP (about 500 emails a day) | free |

Rough capacity on this plan: thousands of accounts, about 50–100 people using it at the same time, and about 16 GB free for uploaded files. Upgrade the plan in Vultr if it gets slow; the data stays.

The commands below run on **Windows PowerShell** from the Petalpace folder unless they say "on the server".

---

## 1. Make an SSH key (once, on your PC)

If `ssh-keygen` isn't found, install **OpenSSH Client** in Windows Settings → System → Optional features.

```powershell
mkdir $HOME\.ssh -Force
ssh-keygen -t ed25519 -f $HOME\.ssh\petalpace_key
```

`petalpace_key` is private. Never share or upload it. Only `petalpace_key.pub` goes to the server.

## 2. Create the server

1. Sign up at [vultr.com](https://www.vultr.com) and add credit (a $5 deposit works if a card can't be linked).
2. **Deploy → Cloud Compute (Shared CPU)**, location **Singapore**, image **Ubuntu**, the $5 plan.
3. Under **SSH Keys**, add the contents of `petalpace_key.pub`. Turn off auto backups and IPv6 if you want the lowest price.
4. Deploy and copy the server's IP address.

If you forgot the SSH key, log in once with the root password from Vultr and paste the `.pub` contents into `/root/.ssh/authorized_keys`.

Check you can log in:

```powershell
ssh -i $HOME\.ssh\petalpace_key root@YOUR_SERVER_IP
```

## 3. Point a Duck DNS address at it

1. Sign in at [duckdns.org](https://www.duckdns.org), add a name (for example `petalpace`).
2. Put the **server's IP** in **current ip** (not your home IP) and click **update ip**.
3. Check it: `nslookup petalpace.duckdns.org 1.1.1.1` should show the server's IP.

## 4. Gmail app password

1. Use a separate Gmail for the app (ours is `petalpace7@gmail.com`) and turn on **2-Step Verification**.
2. Create an app password at [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords). It's 16 letters; remove the spaces.

## 5. Upload the app

```powershell
.\deploy\upload.ps1 -VmIp YOUR_SERVER_IP
```

The first upload also installs Node, nginx and everything else the server needs. Wait for `=== Done ===`.

## 6. Settings file

Pasting into the server terminal is awkward, so write the file on your PC and copy it over.

Create `.env.server` in the Petalpace folder (Git ignores it, and uploads skip it). Use **LF** line endings (bottom-right corner of VS Code):

```
NODE_ENV=production
APP_URL=https://petalpace.duckdns.org
APP_ORIGINS=https://petalpace.duckdns.org
DATA_DIR=/var/lib/petalpace
FEEDBACK_PORT=3001
HOST=127.0.0.1
TRUSTED_PROXY=127.0.0.1
SMTP_USER=petalpace7@gmail.com
SMTP_PASS=your16letterapppassword
FEEDBACK_FROM=Petalpace <petalpace7@gmail.com>
FEEDBACK_TO=your-own-email@gmail.com
```

Copy it to the server:

```powershell
scp -i $HOME\.ssh\petalpace_key .env.server root@YOUR_SERVER_IP:/opt/petalpace/.env.local
```

## 7. Start it with HTTPS

On the server:

```bash
chmod 600 /opt/petalpace/.env.local
bash /opt/petalpace/deploy/configure.sh petalpace.duckdns.org your-email@gmail.com
systemctl status petalpace --no-pager
```

It should say **active (running)**. Open the site, sign up, check the verification email arrives, and attach a file to a task.

If the site shows **502 Bad Gateway**, the app isn't running. `journalctl -u petalpace -n 30 --no-pager` shows why. A `mkdir ... server/data` permission error means the settings file is missing or empty; redo step 6.

## 8. Daily backups

On the server, one line at a time:

```bash
(crontab -l 2>/dev/null; echo "0 2 * * * bash /opt/petalpace/deploy/backup.sh >> /var/log/petalpace-backup.log 2>&1") | crontab -
bash /opt/petalpace/deploy/backup.sh
ls -la /var/backups/petalpace
```

This keeps the last 30 daily copies on the server. Once a week, copy the newest one to your PC (it goes to `PetalpaceBackups` in your user folder):

```powershell
.\deploy\download-backup.ps1 -VmIp YOUR_SERVER_IP
```

Backups hold every user's data. Keep them private and out of Git.

## 9. Key-only logins

On the server, one line at a time:

```bash
echo PasswordAuthentication no > /etc/ssh/sshd_config.d/01-key-only.conf
echo KbdInteractiveAuthentication no >> /etc/ssh/sshd_config.d/01-key-only.conf
sshd -t && systemctl reload ssh
sshd -T | grep -i passwordauthentication
```

The last line should say `passwordauthentication no`. Keep that window open and test logging in from a new PowerShell window before closing it. If you ever lose the key, use **View Console** in Vultr.

---

## Updating the live site

1. Test locally with `npm run dev`, then commit.
2. Upload:

   ```powershell
   .\deploy\upload.ps1 -VmIp YOUR_SERVER_IP
   ```

3. When it says `=== Done ===`, open the site and press **Ctrl+F5**.

Each upload backs up the database first. User data lives in `/var/lib/petalpace`, which uploads never touch, and database changes are applied automatically when the app restarts.

## Monthly maintenance

On the server:

```bash
apt update && apt upgrade -y
reboot
```

Petalpace starts again by itself. Also keep an eye on your Vultr credit; the server is paused when it runs out.

## Useful commands (on the server)

```bash
systemctl status petalpace --no-pager      # is it running?
journalctl -u petalpace -n 50 --no-pager   # recent logs
journalctl -u petalpace -f                 # live logs (Ctrl+C to stop)
systemctl restart petalpace                # restart after changing .env.local
df -h /                                    # free disk space
ls -la /var/backups/petalpace              # backups
```

To change one setting, for example the Gmail password, edit `.env.server` on your PC, copy it again with the `scp` command in step 6, and run `systemctl restart petalpace`.

## Using Resend instead of Gmail

Set `RESEND_API_KEY` and leave out `SMTP_USER` and `SMTP_PASS`. Resend needs a domain you own and have verified, so it doesn't work with Duck DNS.
