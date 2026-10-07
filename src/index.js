import dotenv from "dotenv";
import { connectDB } from "./db/index.js";
import app from "./app.js";
import { initSocket } from './socket.js';
import http from 'http';

// Config dotenv
dotenv.config();

const server = http.createServer(app);

const PORT = process.env.PORT || 8000;

// Connect DB and then start server
connectDB()
  .then(() => {
    initSocket(server);
    server.listen(PORT, () => {
      console.log(`⚙️  Server running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.log('MongoDB connection error: ', err);
  });