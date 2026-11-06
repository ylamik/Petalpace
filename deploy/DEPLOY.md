# Deploying Petalpace on Oracle Cloud (Free Forever)

This guide takes you from zero to a live Petalpace app running on Oracle Cloud's Always Free tier.
It costs ₱0 and keeps running indefinitely.

---

## What you need before starting

- A computer with Git installed
- About 30–45 minutes
- A credit card (Oracle requires it for identity verification — **you will not be charged**)

---

## Step 1 — Create an Oracle Cloud account

1. Go to **[cloud.oracle.com/free](https://cloud.oracle.com/free)**
2. Click **Start for free**
3. Fill in your details and add a credit card (required for verification only)
4. When asked to choose a **Home Region**, pick **Japan (Tokyo)** or **Singapore** — closest to the Philippines
5. Complete sign-up

---

## Step 2 — Create your free VM

1. In the Oracle Cloud dashboard, go to **Compute → Instances → Create Instance**
2. Change the image to **Ubuntu 24.04** (click "Change image")
3. Shape: try **VM.Standard.A1.Flex** with 2 OCPUs and 12 GB first, which is stronger and still free. If you get "Out of host capacity", try another availability domain, or use **VM.Standard.E2.1.Micro**
4. Under **Add SSH keys**: choose **Generate a key pair for me** and **download both files**
   - Save `ssh-key-XXXX.key` to your computer as `~/.ssh/petalpace_key`
   - On Windows: save it to `C:\Users\YourName\.ssh\petalpace_key`
5. Click **Create**
6. Wait 2–3 minutes for the VM to start
7. Copy the **Public IP address** shown on the instance page (e.g. `140.238.12.34`)

---

## Step 3 — Open the firewall port on Oracle Cloud

Oracle blocks all ports by default. You need to open port 80 (HTTP) and 443 (HTTPS).

1. Click your instance, then click the **VCN name** (Virtual Cloud Network)
2. Click **Security Lists** → **Default Security List**
3. Click **Add Ingress Rules**
4. Add rule 1:
   - Source CIDR: `0.0.0.0/0`
   - Destination port: `80`
5. Add rule 2:
   - Source CIDR: `0.0.0.0/0`
   - Destination port: `443`
6. Save

---

## Step 4 — Prepare your SSH key (Windows only)

Open PowerShell and run:
```powershell
# Make sure the .ssh folder exists
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.ssh"
# Move the key you downloaded (adjust the path)
Move-Item "C:\Users\YourName\Downloads\ssh-key-XXXX.key" "$env:USERPROFILE\.ssh\petalpace_key"
```

---

## Step 5 — SSH into your VM

```bash
# Mac/Linux:
ssh -i ~/.ssh/petalpace_key ubuntu@YOUR_VM_IP

# Windows PowerShell:
ssh -i $env:USERPROFILE\.ssh\petalpace_key ubuntu@YOUR_VM_IP
```

Replace `YOUR_VM_IP` with the IP from Step 2.

If asked "Are you sure you want to continue connecting?" — type `yes`.

---

## Step 6 — Get a domain

Petalpace needs HTTPS in production, so it can't run on a bare IP address. Point a domain at your VM's public IP before continuing. See "Getting a domain" below.

---

## Step 7 — Upload your app from your computer

Open PowerShell in your project folder and run:

```powershell
powershell -ExecutionPolicy Bypass -File deploy\upload.ps1 YOUR_VM_IP
```

This builds the app, uploads it, and installs everything the VM needs the first time. It uses the key at `C:\Users\YourName\.ssh\petalpace_key`.

---

## Step 8 — Create your environment file on the VM

SSH into the VM and create the config file:

```bash
sudo nano /opt/petalpace/.env.local
```

Paste this and fill in your values:

```
NODE_ENV=production
APP_URL=https://YOUR_DOMAIN
APP_ORIGINS=https://YOUR_DOMAIN
DATA_DIR=/var/lib/petalpace
FEEDBACK_PORT=3001
HOST=127.0.0.1
TRUSTED_PROXY=127.0.0.1

# Email through your Gmail (see "Email setup" below)
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=your 16 letter app password
FEEDBACK_FROM=Petalpace <your-gmail@gmail.com>
FEEDBACK_TO=your-gmail@gmail.com
```

Save with `Ctrl+X`, then `Y`, then `Enter`.

---

## Step 9 — Configure nginx and start the app

Still on the VM, run:

```bash
sudo bash /opt/petalpace/deploy/configure.sh YOUR_DOMAIN your-real-email@gmail.com
```

This configures nginx, starts Petalpace, makes it start on reboot, and sets up free HTTPS.

---

## Step 10 — Test it

Go to `https://YOUR_DOMAIN`, sign up, and attach a file to a task.

---

## Step 11 — Set up daily backups

On the VM, run `sudo crontab -e` and add this line at the bottom:

```
0 2 * * * bash /opt/petalpace/deploy/backup.sh >> /var/log/petalpace-backup.log 2>&1
```

This keeps the last 30 daily backups on the VM.

**Those backups are lost if the VM is lost**, and Oracle may reclaim idle free VMs. Copy one to your computer every week:

```powershell
powershell -ExecutionPolicy Bypass -File deploy\download-backup.ps1 YOUR_VM_IP
```

It saves to `C:\Users\YourName\PetalpaceBackups` and keeps the newest 14. These files hold every user's data, so keep them private.

---

## Updating the app after making changes

1. Test it locally with `npm run dev`
2. Run the same upload command:

```powershell
powershell -ExecutionPolicy Bypass -File deploy\upload.ps1 YOUR_VM_IP
```

It backs up the database, then installs the new version and restarts. User data lives in `/var/lib/petalpace`, which uploads never touch.

---

## Useful commands on the VM

```bash
# View live logs
journalctl -u petalpace -f

# Restart the app
sudo systemctl restart petalpace

# Check if the app is running
sudo systemctl status petalpace

# Check nginx
sudo systemctl status nginx

# View backup files
sudo ls -la /var/backups/petalpace/
```

---

## Getting a domain

The free option is **Duck DNS**:

1. Go to [duckdns.org](https://www.duckdns.org) and sign in with Google or GitHub
2. Type a name, for example `petalpace`, and click **add domain**
3. In the **current ip** box, paste your VM's public IP and click **update ip**
4. Your domain is `petalpace.duckdns.org`. Use it wherever this guide says `YOUR_DOMAIN`

A bought domain also works. Point an **A record** at the VM's public IP.

---

## Email setup (Gmail, free)

Petalpace sends verification, password reset, reminder and invite emails from your Gmail account.

1. Turn on **2-Step Verification** in your Google Account under **Security**
2. Open [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords), name it `Petalpace`, and click **Create**
3. Copy the 16-letter password into `SMTP_PASS` in `.env.local`. Spaces are fine
4. Set `SMTP_USER`, `FEEDBACK_FROM` and `FEEDBACK_TO` to your Gmail address
5. Restart: `sudo systemctl restart petalpace`

Gmail allows about **500 recipients a day**, plenty for under 10 users. The app password only works for sending mail. If it ever leaks, delete it on the same page and create a new one.

To use Resend instead, set `RESEND_API_KEY` and leave `SMTP_USER` and `SMTP_PASS` out. Resend needs a domain you own and have verified.

---

## Summary — what you pay

| Item | Cost |
|---|---|
| Oracle Cloud VM (Always Free) | ₱0 |
| Storage (up to 200 GB) | ₱0 |
| Bandwidth (up to 10 TB/month) | ₱0 |
| Email (about 500 a day via Gmail) | ₱0 |
| Domain (Duck DNS) | ₱0 |
| HTTPS certificate (Let's Encrypt) | ₱0 |
| **Total** | **₱0** |
