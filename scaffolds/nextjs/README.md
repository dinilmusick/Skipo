# MyApp (Skipo Next.js Scaffold)

Pre-wired Next.js 15 App Router + React 19 + Cloudflare Worker application built on the Skipo Architecture Kernel.

## First Step After Copying
Rename this app across the entire repository in one command:
```bash
python3 Skipo/scripts/rename_app.py "YourAppName"
```

## Running the App
```bash
# Install dependencies
npm install

# Start local dev server
npm run dev

# Fullstack build (Vercel / Next.js)
npm run build:fullstack

# API Worker build (Cloudflare Workers)
npm run build:api

# Dual build for both targets
npm run build:all
```
