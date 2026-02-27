import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database('volunteers.db');
db.pragma('foreign_keys = ON');

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE,
    capacity INTEGER NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS volunteers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    service_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
  );
`);

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

// API Routes - Services
app.get('/api/services', (req, res) => {
  const services = db.prepare(`
    SELECT s.*, (SELECT COUNT(*) FROM volunteers v WHERE v.service_id = s.id) as volunteer_count 
    FROM services s 
    ORDER BY s.date ASC
  `).all();
  res.json(services);
});

app.post('/api/services', (req, res) => {
  const { date, capacity, description } = req.body;
  if (!date || !capacity) {
    return res.status(400).json({ error: 'Data e capacidade são obrigatórios' });
  }
  try {
    // Check if date already exists
    const existing = db.prepare('SELECT id FROM services WHERE date = ?').get(date);
    if (existing) {
      return res.status(400).json({ error: 'Já existe um culto cadastrado para esta data' });
    }

    const info = db.prepare('INSERT INTO services (date, capacity, description) VALUES (?, ?, ?)').run(date, capacity, description);
    const newService = { id: Number(info.lastInsertRowid), date, capacity, description, volunteer_count: 0 };
    broadcast({ type: 'SERVICE_ADDED', payload: newService });
    res.status(201).json(newService);
  } catch (error) {
    console.error('Error creating service:', error);
    res.status(500).json({ error: 'Erro ao criar culto' });
  }
});

app.delete('/api/services/:id', (req, res) => {
  const { id } = req.params;
  console.log(`Delete request for service ID: ${id}`);
  try {
    const sId = parseInt(id);
    const result = db.prepare('DELETE FROM services WHERE id = ?').run(sId);
    console.log(`Service ${sId} delete result:`, result);
    broadcast({ type: 'SERVICE_REMOVED', payload: { id: sId } });
    res.status(204).send();
  } catch (error) {
    console.error('Error removing service:', error);
    res.status(500).json({ error: 'Erro ao remover culto' });
  }
});

app.patch('/api/services/:id', (req, res) => {
  const { id } = req.params;
  const { capacity } = req.body;
  console.log(`Updating service ${id} capacity to ${capacity}`);
  if (capacity === undefined) return res.status(400).json({ error: 'Capacidade é obrigatória' });
  try {
    db.prepare('UPDATE services SET capacity = ? WHERE id = ?').run(capacity, id);
    broadcast({ type: 'SERVICE_UPDATED', payload: { id: parseInt(id), capacity: parseInt(capacity) } });
    res.status(200).json({ id: parseInt(id), capacity: parseInt(capacity) });
  } catch (error) {
    console.error('Error updating capacity:', error);
    res.status(500).json({ error: 'Erro ao atualizar capacidade' });
  }
});

// API Routes - Volunteers
app.get('/api/volunteers', (req, res) => {
  const volunteers = db.prepare('SELECT * FROM volunteers ORDER BY created_at DESC').all();
  res.json(volunteers);
});

app.post('/api/volunteers', (req, res) => {
  const { name, service_id } = req.body;
  
  if (!name || !service_id) {
    return res.status(400).json({ error: 'Nome e culto são obrigatórios' });
  }
  
  try {
    const sId = parseInt(service_id.toString());
    
    // Check capacity more robustly
    const currentCount = db.prepare('SELECT COUNT(*) as count FROM volunteers WHERE service_id = ?').get(sId) as any;
    const service = db.prepare('SELECT capacity FROM services WHERE id = ?').get(sId) as any;
    
    if (!service) {
      return res.status(404).json({ error: 'Culto não encontrado' });
    }

    console.log(`Service ${sId}: ${currentCount.count} volunteers, ${service.capacity} capacity`);

    if (currentCount.count >= service.capacity) {
      return res.status(400).json({ error: `Vagas esgotadas para este culto (${currentCount.count}/${service.capacity})` });
    }

    const info = db.prepare('INSERT INTO volunteers (name, service_id) VALUES (?, ?)').run(name, sId);
    const newVolunteer = { id: Number(info.lastInsertRowid), name, service_id: sId, created_at: new Date().toISOString() };
    
    broadcast({ type: 'VOLUNTEER_ADDED', payload: newVolunteer });
    res.status(201).json(newVolunteer);
  } catch (error) {
    console.error('Error adding volunteer:', error);
    res.status(500).json({ error: 'Erro ao salvar voluntário' });
  }
});

app.delete('/api/volunteers/:id', (req, res) => {
  const { id } = req.params;
  try {
    const volunteer = db.prepare('SELECT service_id FROM volunteers WHERE id = ?').get(id) as any;
    if (volunteer) {
      db.prepare('DELETE FROM volunteers WHERE id = ?').run(id);
      broadcast({ type: 'VOLUNTEER_REMOVED', payload: { id: parseInt(id), service_id: volunteer.service_id } });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Erro ao remover voluntário' });
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
