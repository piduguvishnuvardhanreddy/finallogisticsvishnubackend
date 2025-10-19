import express from "express";
import {
  addVehicle,
  getVehicles,
  updateVehicleLocation,
  updateVehicleStatus,
  updateVehicle,
  deleteVehicle,
} from "../controllers/vehicleController.js";
import protect from "../middleware/authMiddleware.js";
import authorizeRoles from "../middleware/roleMiddleware.js";

const router = express.Router();

// Admin only
router.post("/", protect, authorizeRoles("Admin"), addVehicle);
router.get("/", protect, authorizeRoles("Admin"), getVehicles);
router.put("/:id", protect, authorizeRoles("Admin"), updateVehicle);
router.delete("/:id", protect, authorizeRoles("Admin"), deleteVehicle);

// Driver updates location or status
router.put("/:id/location", protect, authorizeRoles("Driver"), updateVehicleLocation);
router.put("/:id/status", protect, authorizeRoles("Driver", "Admin"), updateVehicleStatus);

export default router;

