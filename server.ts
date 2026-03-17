import express from 'express';
import { createServer } from 'http';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Google Script Setup
// We are hardcoding the URL provided by the user to ensure it works, 
// bypassing any potentially broken environment variables.
const scriptUrl = 'https://script.google.com/macros/s/AKfycbxin3v_CEMXweTsVG44Fo2J7Wzu9biukv8SGVavHuoKPVJGh5_OahRMRwXTQhR_smWn/exec';

const app = express();
const server = createServer(app);

app.use(express.json());

// Helper to call Google Script
async function callScript(action: string, payload: any = {}) {
  if (!scriptUrl) {
    throw new Error('GOOGLE_SCRIPT_URL não configurado. Verifique o arquivo .env');
  }

  const url = new URL(scriptUrl);
  url.searchParams.append('action', action);
  url.searchParams.append('_t', Date.now().toString());
  
  Object.keys(payload).forEach(key => {
    if (payload[key] !== undefined && payload[key] !== null) {
      url.searchParams.append(key, payload[key]);
    }
  });

  const response = await fetch(url.toString(), {
    method: 'GET',
    redirect: 'follow'
  });

  if (!response.ok) {
    throw new Error(`Erro no Google Script: ${response.statusText}`);
  }

  const text = await response.text();
  try {
    const result = JSON.parse(text);
    if (result.error) {
      throw new Error(result.error);
    }
    return result.data;
  } catch (e) {
    if (text.toLowerCase().includes('<!doctype html>') || text.includes('<html')) {
      console.error('HTML Response from Google:', text.substring(0, 500));
      throw new Error('O Google retornou uma página HTML em vez de dados. Isso quase sempre significa que na hora de Implantar (Deploy), a opção "Quem pode acessar" (Who has access) NÃO foi definida como "Qualquer pessoa" (Anyone). Por favor, refaça a implantação garantindo essa permissão.');
    }
    throw new Error(`Erro ao ler resposta do Google: ${text.substring(0, 100)}`);
  }
}

// API Routes - Services
app.get('/api/debug-connection', async (req, res) => {
  try {
    if (!scriptUrl) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'A URL do Google Script não está configurada.' 
      });
    }
    
    // Test the connection by fetching services
    await callScript('getServices');
    res.json({ status: 'success', message: 'Conexão com o Google Apps Script estabelecida com sucesso!' });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message, stack: error.stack });
  }
});

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
    res.status(201).json(newService);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/services/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await callScript('deleteService', { id });
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
    res.status(201).json(newVolunteer);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/volunteers/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await callScript('deleteVolunteer', { id });
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
