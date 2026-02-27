import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Google Script Setup
const scriptUrl = process.env.GOOGLE_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbxin3v_CEMXweTsVG44Fo2J7Wzu9biukv8SGVavHuoKPVJGh5_OahRMRwXTQhR_smWn/exec';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());

// Broadcast to all clients
function broadcast(data: any) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

// Helper to call Google Script
async function callScript(action: string, payload: any = {}) {
  if (!scriptUrl) {
    throw new Error('GOOGLE_SCRIPT_URL não configurado. Verifique o arquivo .env');
  }

  const response = await fetch(scriptUrl, {
    method: 'POST',
    body: JSON.stringify({ action, ...payload }),
  });

  if (!response.ok) {
    throw new Error(`Erro no Google Script: ${response.statusText}`);
  }

  const result = await response.json();
  if (result.error) {
    throw new Error(result.error);
  }
  return result.data;
}

// API Routes - Services
app.get('/api/services', async (req, res) => {
  try {
    const data = await callScript('getServices');
    res.json(data);
  } catch (error: any) {
    console.error('Error fetching services:', error);
    res.status(500).json({ error: error.message || 'Erro ao buscar cultos' });
  }
});

app.post('/api/services', async (req, res) => {
  const { date, capacity, description } = req.body;
  if (!date || !capacity) return res.status(400).json({ error: 'Data e capacidade são obrigatórios' });

  try {
    const newService = await callScript('addService', { date, capacity, description });
    broadcast({ type: 'SERVICE_ADDED', payload: newService });
    res.status(201).json(newService);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/services/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await callScript('deleteService', { id });
    broadcast({ type: 'SERVICE_REMOVED', payload: { id: parseInt(id) } });
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/services/:id', async (req, res) => {
  const { id } = req.params;
  const { capacity } = req.body;
  try {
    await callScript('updateServiceCapacity', { id, capacity });
    broadcast({ type: 'SERVICE_UPDATED', payload: { id: parseInt(id), capacity: parseInt(capacity) } });
    res.status(200).json({ id: parseInt(id), capacity: parseInt(capacity) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// API Routes - Volunteers
app.get('/api/volunteers', async (req, res) => {
  try {
    const data = await callScript('getVolunteers');
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/volunteers', async (req, res) => {
  const { name, service_id } = req.body;
  if (!name || !service_id) return res.status(400).json({ error: 'Nome e culto são obrigatórios' });

  try {
    const newVolunteer = await callScript('addVolunteer', { name, service_id });
    broadcast({ type: 'VOLUNTEER_ADDED', payload: newVolunteer });
    res.status(201).json(newVolunteer);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/volunteers/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await callScript('deleteVolunteer', { id });
    broadcast({ type: 'VOLUNTEER_REMOVED', payload: { id: parseInt(id), service_id: result.service_id } });
    res.status(204).send();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Vite middleware for development
if (process.env.NODE_ENV !== 'production') {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static('dist'));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist/index.html'));
  });
}

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
