import express from "express";
import { addMoneyToWallet, getWalletBalance } from "../controllers/addMoneyController.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

// NEW ADD MONEY ROUTES - Simple and clean
router.post("/add", protect, addMoneyToWallet);
router.get("/balance", protect, getWalletBalance);

export default router;
