import express from "express";
import {
  createDelivery,
  updateDeliveryStatus,
  trackDelivery,
  getAllDeliveries,
  createCustomerBooking,
  getCustomerBookings,
  getCustomerBookingById,
  cancelCustomerBooking,
  approveDelivery,
  assignDelivery,
  acceptDelivery,
  rejectDelivery,
  getDriverAssignedDeliveries,
  deleteDelivery,
  startDelivery,
  completeDelivery,
  updateDeliveryLocation,
  rateDelivery,
  cancelDeliveryAdvanced,
  searchDeliveries,
  getDeliveryStats
} from "../controllers/deliveryController.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

// Customer booking routes
router.post("/customer/book", protect, createCustomerBooking);
router.get("/customer/my-bookings", protect, getCustomerBookings);
router.get("/customer/:id", protect, getCustomerBookingById);
router.put("/customer/:id/cancel", protect, cancelCustomerBooking);

// Driver routes
router.get("/driver/assigned", protect, getDriverAssignedDeliveries);
router.put("/:id/accept", protect, acceptDelivery);
router.put("/:id/reject", protect, rejectDelivery);
router.put("/:id/start", protect, startDelivery);
router.put("/:id/complete", protect, completeDelivery);
router.put("/:id/location", protect, updateDeliveryLocation);

// Admin routes
router.put("/:id/approve", protect, approveDelivery);
router.put("/:id/assign", protect, assignDelivery);

// Rating and feedback
router.post("/:id/rate", protect, rateDelivery);

// Search and stats
router.get("/search", protect, searchDeliveries);
router.get("/stats", protect, getDeliveryStats);

// Advanced cancellation
router.put("/:id/cancel-advanced", protect, cancelDeliveryAdvanced);

// General delivery routes
router.post("/", protect, createDelivery);
router.put("/:id/status", protect, updateDeliveryStatus);
router.get("/:id/track", protect, trackDelivery);
router.get("/", protect, getAllDeliveries);
router.delete("/:id", protect, deleteDelivery);

export default router;

