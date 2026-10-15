# ZENKAI Auth & Deep Link Gateway ⚡

Cloudflare Worker & Web Landing Gateway for **ZENKAI** (Supabase OAuth & Mobile Deep Linking).

## What it does:
1. **Handles Supabase Redirects**: Resolves the `http://localhost:3000` redirect issue by serving as the central **Site URL** and callback gateway for Supabase Auth.
2. **Deep Links to Android App**: Parses access tokens, refresh tokens, and auth codes and opens `aniverse://login-callback` to log the user into the APK seamlessly.
3. **Android App Links**: Serves `/.well-known/assetlinks.json` with the SHA-256 fingerprint for `com.nyyrox.aniverse`.
4. **Dark Monochrome Design**: Obsidian glass landing page matching the ZENKAI aesthetic.

---

## Deploy to Cloudflare Workers (1-Minute Setup):

```bash
# 1. Install dependencies
npm install

# 2. Deploy to your Cloudflare account
npx wrangler deploy
```

Once deployed, Cloudflare gives you a live URL like:
`https://zenkai-auth-worker.<your-subdomain>.workers.dev`

---

## Connect to Supabase:
1. Go to: **[Supabase Dashboard -> Authentication -> URL Configuration](https://supabase.com/dashboard/project/voxeodunvjrhtbjvbbxt/auth/url-configuration)**
2. Set **Site URL** to:
   ```text
   https://zenkai-auth-worker.<your-subdomain>.workers.dev
   ```
3. Under **Redirect URLs**, add:
   ```text
   https://zenkai-auth-worker.<your-subdomain>.workers.dev/**
   aniverse://login-callback
   ```
4. Click **Save**.

Now all web redirects, OAuth callbacks, and magic links will route through your custom worker directly into the ZENKAI APK!
