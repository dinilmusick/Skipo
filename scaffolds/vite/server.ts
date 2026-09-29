/**
 * @file server.ts
 * @description Express Gateway & Dev Server for MyApp.
 * Pre-wired with authentication, workspace, and storage API routes.
 * Integrates Vite middleware in dev and serves dist/ in production.
 * Conforms to Skipo Governance (< 200 lines).
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { appBackend } from './src/backend/AppBackend';

dotenv.config();

const PORT = parseInt(process.env.PORT || '3000', 10);

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // CORS headers
  app.use((_req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id');
    next();
  });

  // Health check
  app.get(['/api/health', '/health'], (_req, res) => {
    res.json({ status: 'ok', service: 'my-app', timestamp: new Date().toISOString() });
  });

  // Auth routes
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password, isAdmin } = req.body;
      const result = await appBackend.services.auth.loginUser(email, password, isAdmin);
      res.status(result.status || (result.success ? 200 : 401)).json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/auth/register', async (req, res) => {
    try {
      const result = await appBackend.services.auth.registerUser(req.body);
      res.status(result.status || (result.success ? 201 : 400)).json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Workspaces routes
  app.get(['/api/auth/workspaces', '/api/workspace'], async (req, res) => {
    try {
      const userId = (req.headers['x-user-id'] as string) || (req.query.userId as string);
      const result = await appBackend.services.workspace.getWorkspaces(userId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post(['/api/auth/workspaces', '/api/workspace'], async (req, res) => {
    try {
      const userId = (req.headers['x-user-id'] as string) || 'default';
      const result = await appBackend.services.workspace.createWorkspace(userId, req.body);
      res.status(201).json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Storage connection routes
  app.get('/api/auth/storage/connections', async (req, res) => {
    try {
      const userId = req.headers['x-user-id'] as string;
      const result = await appBackend.services.storage.getStorageConnections(userId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/auth/storage/connections', async (req, res) => {
    try {
      const userId = (req.headers['x-user-id'] as string) || 'default';
      const result = await appBackend.services.storage.saveStorageConnection(userId, req.body);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/auth/storage/test', async (req, res) => {
    try {
      const result = await appBackend.services.storage.testStorageConnection(req.body);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Vite middleware in dev or static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[MyApp] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[MyApp] Failed to start server:', err);
  process.exit(1);
});
