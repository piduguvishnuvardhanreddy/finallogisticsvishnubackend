import Tracking from "../models/Tracking.js";
import Vehicle from "../models/Vehicle.js";

export default (io) => {
  io.on("connection", (socket) => {
    console.log("✅ New client connected:", socket.id);

    // DRIVER sends location updates
    socket.on("driverLocationUpdate", async (data) => {
      try {
        const { driverId, vehicleId, deliveryId, lat, lng } = data;

        // Save latest location in DB
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

        // Update vehicle live location in Vehicle model
        await Vehicle.findByIdAndUpdate(vehicleId, {
          currentLocation: { lat, lng },
        });

        // Broadcast to customers tracking the same delivery
        io.emit(`deliveryLocation_${deliveryId}`, { lat, lng, driverId, vehicleId });
      } catch (error) {
        console.error("Error updating driver location:", error.message);
      }
    });

    socket.on("disconnect", () => {
      console.log("❌ Client disconnected:", socket.id);
    });
  });
};
