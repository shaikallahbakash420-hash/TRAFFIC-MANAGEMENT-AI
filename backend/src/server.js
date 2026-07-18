import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import { startSimulation } from './services/simulator.js';
import trafficRouter from './routes/traffic.js';
import vehiclesRouter from './routes/vehicles.js';
import analyticsRouter from './routes/analytics.js';
import incidentsRouter from './routes/incidents.js';

const app = express();
const PORT = process.env.PORT || 5001;

// Create HTTP server for WebSockets
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: '*', // Allow connections from Vite dev server (usually localhost:5173)
    methods: ['GET', 'POST', 'PUT']
  }
});

app.use(cors());
app.use(express.json());

// REST Routers
app.use('/api', trafficRouter);
app.use('/api/vehicles', vehiclesRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/incidents', incidentsRouter);

app.get('/', (req, res) => {
  res.json({
    status: 'online',
    message: 'TRAFFIC.AI Indian Urban Traffic Controller Server is Operational',
    sqlite: 'connected',
    websockets: 'active'
  });
});

// Socket connection logs
io.on('connection', (socket) => {
  console.log(`Command Center Client Connected: ${socket.id}`);
  
  socket.on('disconnect', () => {
    console.log(`Command Center Client Disconnected: ${socket.id}`);
  });
});

// Start Real-Time Simulator with Socket.io broadcast ability
startSimulation(io);

// Listen on the HTTP Server (not the Express App directly)
server.listen(PORT, () => {
  console.log(`SQLite + WebSockets Traffic AI Server running on port ${PORT}`);
});
