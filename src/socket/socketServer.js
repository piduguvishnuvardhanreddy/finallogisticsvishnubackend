import { Server } from "socket.io";
import Tracking from "../models/Tracking.js";
import Vehicle from "../models/Vehicle.js";
import Delivery from "../models/Delivery.js";

/**
 * Initialize Socket.io server for real-time tracking
 */
export const initSocketServer = (server) => {
  const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
  });

  io.on("connection", (socket) => {
    console.log("✅ Client connected:", socket.id);

    // Driver location updates
    socket.on("driverLocationUpdate", async (data) => {
      try {
        const { driverId, vehicleId, deliveryId, lat, lng } = data;

        // Update or create tracking record
        await Tracking.findOneAndUpdate(
          { driver: driverId, delivery: deliveryId },
          {
            driver: driverId,
            vehicle: vehicleId,
            delivery: deliveryId,
            currentLocation: { lat, lng },
            lastUpdated: new Date(),
          },
          { upsert: true, new: true }
        );

        // Update vehicle current location
        await Vehicle.findByIdAndUpdate(vehicleId, {
          currentLocation: { lat, lng },
        });

        // Broadcast location to all clients tracking this delivery
        io.emit(`deliveryLocation_${deliveryId}`, { lat, lng, driverId, vehicleId });
      } catch (err) {
        console.error("Error updating driver location:", err.message);
      }
    });

    // Join delivery room for tracking
    socket.on("joinDeliveryTracking", (deliveryId) => {
      socket.join(`delivery_${deliveryId}`);
      console.log(`Client ${socket.id} joined tracking for delivery ${deliveryId}`);
    });

    // Leave delivery room
    socket.on("leaveDeliveryTracking", (deliveryId) => {
      socket.leave(`delivery_${deliveryId}`);
      console.log(`Client ${socket.id} left tracking for delivery ${deliveryId}`);
    });

    // Join delivery room (for customer dashboard)
    socket.on("joinDelivery", (deliveryId) => {
      socket.join(`delivery_${deliveryId}`);
      console.log(`\ud83d\udce1 Client ${socket.id} joined delivery room: ${deliveryId}`);
    });

    // Leave delivery room (for customer dashboard)
    socket.on("leaveDelivery", (deliveryId) => {
      socket.leave(`delivery_${deliveryId}`);
      console.log(`\ud83d\udccd Client ${socket.id} left delivery room: ${deliveryId}`);
    });

    // Delivery status update
    socket.on("deliveryStatusUpdate", async (data) => {
      try {
        const { deliveryId, status, userId } = data;
        
        const delivery = await Delivery.findById(deliveryId)
          .populate("customer", "name")
          .populate("assignedDriver", "name");
        
        if (delivery) {
          // Broadcast to all clients tracking this delivery
          io.to(`delivery_${deliveryId}`).emit("statusChanged", {
            deliveryId,
            status,
            timestamp: new Date(),
            delivery
          });
        }
      } catch (err) {
        console.error("Error broadcasting status update:", err.message);
      }
    });

    // Real-time notification
    socket.on("sendNotification", (data) => {
      const { userId, message, type } = data;
      io.emit(`notification_${userId}`, { message, type, timestamp: new Date() });
    });

    socket.on("disconnect", () => {
      console.log("❌ Client disconnected:", socket.id);
    });
  });

  // Store io instance globally for use in controllers
  global.io = io;

  console.log("⚡ Socket.io server initialized");
};
