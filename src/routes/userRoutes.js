import express from "express";
import {
  getAllDrivers,
  getDriverById,
  updateDriverStatus,
  getDriversOverview,
  getUserProfile,
  updateUserProfile,
  getWallet,
  withdrawEarnings,
  getDriverEarnings,
  searchUsers
} from "../controllers/userController.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

// Profile routes
router.get("/profile", protect, getUserProfile);
router.put("/profile", protect, updateUserProfile);

// Wallet routes
router.get("/wallet", protect, getWallet);
router.post("/wallet/withdraw", protect, withdrawEarnings);

// Driver management (Admin)
router.get("/drivers", protect, getAllDrivers);
router.get("/drivers/stats/overview", protect, getDriversOverview);
router.get("/drivers/:id", protect, getDriverById);
router.put("/drivers/:id/status", protect, updateDriverStatus);
router.get("/drivers/:id/earnings", protect, getDriverEarnings);

// Search
router.get("/search", protect, searchUsers);

export default router;
