# MyApp (Skipo Vite Scaffold)

Pre-wired Vite + React 19 + Express + Cloudflare Worker application built on the Skipo Architecture Kernel.

## First Step After Copying
Rename this app across the entire repository in one command:
```bash
python3 Skipo/scripts/rename_app.py "YourAppName"
```

## Running the App
```bash
# Install dependencies
npm install

# Start local dev server (Express + Vite)
npm run dev

# Fullstack build (Vercel / Node)
npm run build:fullstack

# API Worker build (Cloudflare Workers)
npm run build:api

# Dual build for both targets
npm run build:all
```
