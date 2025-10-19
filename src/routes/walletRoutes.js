import express from "express";
import {
  addMoneyToCustomerWallet,
  getCustomerWalletBalance,
  payDeliveryWithWallet,
  getDriverWalletBalance,
  withdrawDriverEarnings,
  payoutToDriver,
  getAdminWalletBalance
} from "../controllers/walletController.js";
import protect from "../middleware/authMiddleware.js";
import authorizeRoles from "../middleware/roleMiddleware.js";

const router = express.Router();

// Customer wallet routes - Add money only needs authentication, not role check
router.post("/customer/add-money", protect, addMoneyToCustomerWallet);
router.get("/customer/balance", protect, getCustomerWalletBalance);
router.post("/customer/pay-delivery", protect, payDeliveryWithWallet);

// Driver wallet routes
router.get("/driver/balance", protect, getDriverWalletBalance);
router.post("/driver/withdraw", protect, withdrawDriverEarnings);

// Admin wallet routes
router.get("/admin/balance", protect, authorizeRoles("Admin"), getAdminWalletBalance);
router.post("/admin/payout-driver", protect, authorizeRoles("Admin"), payoutToDriver);

export default router;
