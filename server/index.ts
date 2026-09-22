import path from 'path';
import fs from 'fs';
import express from 'express';
import { createApp } from './app';
import { config } from './config';

const app = createApp();

const distDir = path.resolve(process.cwd(), 'dist');

// Serve static assets from dist in production or whenever dist is built (for local npm start / Docker)
if (!process.env.VERCEL && (config.env === 'production' || fs.existsSync(distDir))) {
  app.use(express.static(distDir));
  app.get('{*path}', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

// Only listen locally — Vercel invokes serverless handlers directly via api/
if (!process.env.VERCEL) {
  app.listen(config.port, () => {
    console.log(`[MySpace AI Server] Running on http://localhost:${config.port} (env: ${config.env})`);
  });
}
