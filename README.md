# 🏄 Surf Alert — Palmachim

Sends a Telegram message every **Thursday & Friday at 7am** (Israel time) if Palmachim has good surf conditions:
- Wave height ≥ 1.5m
- Wind speed ≤ 25 kph

---

## Deploy to Netlify (step by step)

### 1. Upload to GitHub
- Go to https://github.com/new and create a new repository (call it `surf-alert`)
- Upload all these files to it

### 2. Connect to Netlify
- Go to https://netlify.com and log in (or sign up free)
- Click **"Add new site" → "Import an existing project"**
- Connect your GitHub account and select the `surf-alert` repo
- Leave all build settings as default and click **Deploy**

### 3. Add your Telegram credentials as environment variables
- In Netlify, go to your site → **Site configuration → Environment variables**
- Add these two variables:

| Key | Value |
|-----|-------|
| `TELEGRAM_BOT_TOKEN` | Your bot token from BotFather |
| `TELEGRAM_CHAT_ID` | `926431086` |

### 4. Done!
The function will run automatically every Thursday & Friday at 7am Israel time.
You'll only get a message when waves are actually good — no spam on flat days.

---

## To test it manually
In Netlify dashboard → **Functions** → find `surf-check` → click **Test function**
