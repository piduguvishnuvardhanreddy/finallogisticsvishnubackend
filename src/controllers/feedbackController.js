import Feedback from "../models/Feedback.js";
import User from "../models/User.js";
import Delivery from "../models/Delivery.js";

/**
 * POST /api/feedback
 * Submit feedback for a delivery (Customer only)
 */
export const submitFeedback = async (req, res) => {
  try {
    const customerId = req.user._id;
    const { deliveryId, rating, feedback, tags, categories } = req.body;

    // Validate delivery
    const delivery = await Delivery.findById(deliveryId);
    if (!delivery) {
      return res.status(404).json({ message: "Delivery not found" });
    }

    // Check if delivery belongs to customer
    if (delivery.customer.toString() !== customerId.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // Check if delivery is completed
    if (delivery.status !== "Delivered") {
      return res.status(400).json({ message: "Can only provide feedback for delivered orders" });
    }

    // Check if feedback already exists
    const existingFeedback = await Feedback.findOne({ delivery: deliveryId });
    if (existingFeedback) {
      return res.status(400).json({ message: "Feedback already submitted for this delivery" });
    }

    // Create feedback
    const newFeedback = await Feedback.create({
      delivery: deliveryId,
      customer: customerId,
      driver: delivery.assignedDriver,
      rating: {
        stars: rating,
        categories: categories || {}
      },
      feedback,
      tags: tags || []
    });

    // Update driver's average rating
    const driver = await User.findById(delivery.assignedDriver);
    if (driver && driver.driverProfile) {
      const allFeedback = await Feedback.find({ driver: delivery.assignedDriver });
      const avgRating = allFeedback.reduce((sum, f) => sum + f.rating.stars, 0) / allFeedback.length;
      
      driver.driverProfile.performance.averageRating = avgRating;
      driver.driverProfile.ratings.push({
        stars: rating,
        feedback,
        delivery: deliveryId,
        createdAt: new Date()
      });
      await driver.save();
    }

    // Update delivery with feedback reference
    delivery.feedback = newFeedback._id;
    await delivery.save();

    const populated = await Feedback.findById(newFeedback._id)
      .populate("customer", "name email")
      .populate("driver", "name email")
      .populate("delivery", "deliveryId");

    res.status(201).json({
      success: true,
      message: "Feedback submitted successfully",
      feedback: populated
    });
  } catch (error) {
    console.error("Submit feedback error:", error);
    res.status(500).json({ message: "Failed to submit feedback" });
  }
};

/**
 * GET /api/feedback
 * Get all feedback (Admin only)
 */
export const getAllFeedback = async (req, res) => {
  try {
    const { driverId, rating, viewed } = req.query;
    const filter = {};

    if (driverId) filter.driver = driverId;
    if (rating) filter["rating.stars"] = parseInt(rating);
    if (viewed !== undefined) filter.adminViewed = viewed === "true";

    const feedback = await Feedback.find(filter)
      .populate("customer", "name email")
      .populate("driver", "name email")
      .populate("delivery", "deliveryId status")
      .sort({ createdAt: -1 });

    res.json(feedback);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch feedback" });
  }
};

/**
 * GET /api/feedback/:id
 * Get specific feedback
 */
export const getFeedbackById = async (req, res) => {
  try {
    const { id } = req.params;

    const feedback = await Feedback.findById(id)
      .populate("customer", "name email phone")
      .populate("driver", "name email phone")
      .populate("delivery");

    if (!feedback) {
      return res.status(404).json({ message: "Feedback not found" });
    }

    res.json(feedback);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch feedback" });
  }
};

/**
 * PUT /api/feedback/:id/mark-viewed
 * Mark feedback as viewed by admin
 */
export const markFeedbackViewed = async (req, res) => {
  try {
    const { id } = req.params;

    const feedback = await Feedback.findByIdAndUpdate(
      id,
      { adminViewed: true },
      { new: true }
    );

    if (!feedback) {
      return res.status(404).json({ message: "Feedback not found" });
    }

    res.json({ message: "Feedback marked as viewed", feedback });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to update feedback" });
  }
};

/**
 * POST /api/feedback/:id/respond
 * Admin responds to feedback
 */
export const respondToFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    const adminId = req.user._id;

    const feedback = await Feedback.findById(id);
    if (!feedback) {
      return res.status(404).json({ message: "Feedback not found" });
    }

    feedback.adminResponse = {
      message,
      respondedBy: adminId,
      respondedAt: new Date()
    };
    feedback.adminViewed = true;
    await feedback.save();

    const populated = await Feedback.findById(id)
      .populate("customer", "name email")
      .populate("driver", "name email")
      .populate("adminResponse.respondedBy", "name");

    res.json({ message: "Response sent successfully", feedback: populated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to respond to feedback" });
  }
};

/**
 * GET /api/feedback/driver/:driverId/stats
 * Get feedback statistics for a driver
 */
export const getDriverFeedbackStats = async (req, res) => {
  try {
    const { driverId } = req.params;

    const feedback = await Feedback.find({ driver: driverId });

    const stats = {
      total: feedback.length,
      averageRating: feedback.length > 0 
        ? feedback.reduce((sum, f) => sum + f.rating.stars, 0) / feedback.length 
        : 0,
      ratingDistribution: {
        5: feedback.filter(f => f.rating.stars === 5).length,
        4: feedback.filter(f => f.rating.stars === 4).length,
        3: feedback.filter(f => f.rating.stars === 3).length,
        2: feedback.filter(f => f.rating.stars === 2).length,
        1: feedback.filter(f => f.rating.stars === 1).length
      },
      recentFeedback: feedback.slice(0, 5)
    };

    res.json(stats);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to get feedback stats" });
  }
};

/**
 * GET /api/feedback/search
 * Search feedback
 */
export const searchFeedback = async (req, res) => {
  try {
    const { query, minRating, maxRating, startDate, endDate } = req.query;
    const filter = {};

    if (query) {
      filter.$or = [
        { feedback: { $regex: query, $options: "i" } },
        { tags: { $in: [new RegExp(query, "i")] } }
      ];
    }

    if (minRating) filter["rating.stars"] = { $gte: parseInt(minRating) };
    if (maxRating) {
      filter["rating.stars"] = { 
        ...filter["rating.stars"], 
        $lte: parseInt(maxRating) 
      };
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const results = await Feedback.find(filter)
      .populate("customer", "name email")
      .populate("driver", "name email")
      .populate("delivery", "deliveryId")
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(results);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Search failed" });
  }
};
