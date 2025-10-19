import express from "express";
import http from "http";
import dotenv from "dotenv";
import cors from "cors";
import connectDB from "./config/db.js";

import authRoutes from "./routes/authRoutes.js";
import vehicleRoutes from "./routes/vehicleRoutes.js";
import deliveryRoutes from "./routes/deliveryRoutes.js";
import feedbackRoutes from "./routes/feedbackRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import walletRoutes from "./routes/walletRoutes.js";
import addMoneyRoutes from "./routes/addMoneyRoutes.js";

import { initSocketServer } from "./socket/socketServer.js";

dotenv.config();
connectDB();

const app = express();
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/vehicles", vehicleRoutes);
app.use("/api/deliveries", deliveryRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/users", userRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/money", addMoneyRoutes); // NEW ADD MONEY ROUTE

// Root
app.get("/", (req, res) => res.send("🚚 Logistics API is running with Realtime Tracking"));

// HTTP server
const server = http.createServer(app);

// Attach Socket.io
initSocketServer(server);

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () =>
  console.log(`Server running on port ${PORT} 🚀`)
);




