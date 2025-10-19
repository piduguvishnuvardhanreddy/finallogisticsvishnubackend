// src/routes/authRoutes.js
import express from "express";
import { registerUser, loginUser, getProfile, getDrivers, getAllUsers } from "../controllers/authController.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/profile", protect, getProfile);
router.get("/me", protect, getProfile); // Alias for /profile
router.get("/drivers", protect, getDrivers);
router.get("/users", protect, getAllUsers);

export default router;
