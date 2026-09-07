import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';

dotenv.config({ override: true });

const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbyQKNRuKzhEcTXWrVHsJamJAExEx6xUAhw1ZOChEkMPQqhnTTDnGNsFYXqmswRNBLpQ/exec';

function getGasUrl(): string {
  try {
    if (fs.existsSync('.env')) {
      const content = fs.readFileSync('.env', 'utf-8');
      const match = content.match(/VITE_GAS_API_URL=["']?([^"'\r\n]+)["']?/);
      if (match && match[1] && !match[1].includes('YOUR_SCRIPT_ID') && match[1].trim().length > 10) {
        return match[1].trim();
      }
    }
  } catch (e) {
    console.error('Error reading .env file:', e);
  }

  const raw = process.env.VITE_GAS_API_URL || process.env.GAS_API_URL || DEFAULT_GAS_URL;
  return raw.replace(/^["']|["']$/g, '').trim() || DEFAULT_GAS_URL;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Proxy endpoint for Google Apps Script Web App
  app.all('/api/gas', async (req, res) => {
    const gasUrl = getGasUrl();
    if (!gasUrl || gasUrl.includes('YOUR_SCRIPT_ID')) {
      return res.status(400).json({
        success: false,
        message: 'Google Apps Script URL belum dikonfigurasi. Harap atur VITE_GAS_API_URL di file .env',
      });
    }

    try {
      if (req.method === 'GET') {
        const url = new URL(gasUrl);
        Object.entries(req.query).forEach(([k, v]) => {
          if (typeof v === 'string') {
            url.searchParams.append(k, v);
          }
        });

        const response = await fetch(url.toString(), {
          method: 'GET',
          redirect: 'follow',
        });

        const responseText = await response.text();
        try {
          const data = JSON.parse(responseText);
          return res.status(response.status || 200).json(data);
        } catch {
          if (responseText.includes('<!DOCTYPE html>') || responseText.includes('accounts.google.com')) {
            return res.status(403).json({
              success: false,
              message: 'Akses Google Apps Script ditolak (Memerlukan Login Google). Pastikan Web App di-deploy dengan opsi "Who has access: Anyone" (Siapa saja).',
            });
          }
          return res.status(response.status || 200).send(responseText);
        }
      } else {
        // POST / other methods
        const payload = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
        
        const response = await fetch(gasUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8',
          },
          body: payload,
          redirect: 'follow',
        });

        const responseText = await response.text();
        try {
          const data = JSON.parse(responseText);
          return res.status(response.status || 200).json(data);
        } catch {
          if (responseText.includes('<!DOCTYPE html>') || responseText.includes('accounts.google.com')) {
            return res.status(403).json({
              success: false,
              message: 'Akses Google Apps Script ditolak (Memerlukan Login Google). Pastikan Web App di-deploy dengan opsi "Who has access: Anyone" (Siapa saja).',
            });
          }
          return res.status(response.status || 200).json({
            success: false,
            message: `Format respon backend tidak valid: ${responseText.substring(0, 150)}`,
          });
        }
      }
    } catch (error: any) {
      console.error('Error forwarding request to Google Apps Script:', error);
      return res.status(500).json({
        success: false,
        message: error.message || 'Gagal terhubung ke Google Apps Script backend',
      });
    }
  });

  app.get('/api/health', (_req, res) => {
    const url = getGasUrl();
    res.json({ status: 'ok', gasUrl: url ? url.substring(0, 45) + '...' : null });
  });

  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: PORT },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
