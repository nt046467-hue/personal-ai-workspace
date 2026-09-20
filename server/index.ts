import path from 'path';
import fs from 'fs';
import express from 'express';
import { createApp } from './app';
import { config } from './config';

const app = createApp();

const distDir = path.resolve(process.cwd(), 'dist');

// Serve static assets from dist in production or whenever dist is built
if (config.env === 'production' || fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('{*path}', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

app.listen(config.port, () => {
  console.log(`[MySpace AI Server] Running on http://localhost:${config.port} (env: ${config.env})`);
});

