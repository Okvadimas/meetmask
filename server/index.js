import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import RoomManager from './roomManager.js';
import { setupSignaling } from './signaling.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.use(cors());

// In production, serve the Vite build
const distPath = join(__dirname, '..', 'dist');
app.use(express.static(distPath));

// Health check endpoint
app.get('/api/health', (req, res) => {
  const stats = roomManager.getStats();
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    ...stats,
  });
});

// SPA fallback for production
app.get('/{*path}', (req, res) => {
  res.sendFile(join(distPath, 'index.html'));
});

// Initialize room manager and signaling
const roomManager = new RoomManager();
setupSignaling(io, roomManager);

// Log stats periodically
setInterval(() => {
  const stats = roomManager.getStats();
  if (stats.totalRooms > 0) {
    console.log(`[Stats] Rooms: ${stats.totalRooms}, Participants: ${stats.totalParticipants}`);
  }
}, 30000);

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════╗
  ║   🎭 MeetMask Server Running        ║
  ║   Port: ${PORT}                        ║
  ║   http://localhost:${PORT}             ║
  ╚══════════════════════════════════════╝
  `);
});
