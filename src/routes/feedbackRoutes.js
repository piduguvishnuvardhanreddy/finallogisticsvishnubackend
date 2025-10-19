import express from "express";
import {
  submitFeedback,
  getAllFeedback,
  getFeedbackById,
  markFeedbackViewed,
  respondToFeedback,
  getDriverFeedbackStats,
  searchFeedback
} from "../controllers/feedbackController.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

// Customer routes
router.post("/submit", protect, submitFeedback);

// Admin routes
router.get("/", protect, getAllFeedback);
router.get("/search", protect, searchFeedback);
router.get("/:id", protect, getFeedbackById);
router.put("/:id/mark-viewed", protect, markFeedbackViewed);
router.post("/:id/respond", protect, respondToFeedback);

// Driver feedback stats
router.get("/driver/:driverId/stats", protect, getDriverFeedbackStats);

export default router;
