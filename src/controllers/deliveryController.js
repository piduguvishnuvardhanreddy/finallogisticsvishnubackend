import Delivery from "../models/Delivery.js";
import Vehicle from "../models/Vehicle.js";
import User from "../models/User.js";
import Feedback from "../models/Feedback.js";

/**
 * POST /api/deliveries
 * Create a new delivery
 */
export const createDelivery = async (req, res) => {
  try {
    const {
      pickupLocation,
      dropLocation,
      assignedDriver,
      assignedVehicle,
      customer,
      startTime,
      endTime,
    } = req.body;

    if (!assignedDriver || !assignedVehicle)
      return res.status(400).json({ message: "Driver and vehicle are required." });

    // Conflict detection — same driver or vehicle overlap
    const overlapping = await Delivery.findOne({
      $or: [
        { assignedDriver },
        { assignedVehicle },
      ],
      status: { $in: ["Pending", "On Route"] },
      $or: [
        { startTime: { $lt: endTime }, endTime: { $gt: startTime } },
      ],
    });

    if (overlapping) {
      return res.status(400).json({
        message: "Driver or vehicle is already booked for that time.",
      });
    }

    const delivery = await Delivery.create({
      pickupLocation,
      dropLocation,
      assignedDriver,
      assignedVehicle,
      customer,
      startTime,
      endTime,
    });

    // Update vehicle to "On Route"
    await Vehicle.findByIdAndUpdate(assignedVehicle, { status: "On Route" });

    res.status(201).json(delivery);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to create delivery" });
  }
};

/**
 * PUT /api/deliveries/:id/status
 */
export const updateDeliveryStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const delivery = await Delivery.findById(id);
    if (!delivery) return res.status(404).json({ message: "Delivery not found" });

    delivery.status = status;
    await delivery.save();

    if (status === "Delivered" || status === "Cancelled") {
      await Vehicle.findByIdAndUpdate(delivery.assignedVehicle, { status: "Available" });
    }

    // Emit Socket.IO event for real-time updates
    if (global.io) {
      global.io.to(`delivery_${id}`).emit('statusUpdate', {
        deliveryId: id,
        status,
        timestamp: new Date()
      });
      console.log(`📡 Status update emitted for delivery ${id}: ${status}`);
    }

    res.json(delivery);
  } catch (error) {
    res.status(500).json({ message: "Failed to update delivery status" });
  }
};

/**
 * GET /api/deliveries/:id/track
 */
export const trackDelivery = async (req, res) => {
  try {
    const { id } = req.params;
    const delivery = await Delivery.findById(id)
      .populate("assignedDriver", "name email role")
      .populate("assignedVehicle", "name plateNumber type status");

    if (!delivery) return res.status(404).json({ message: "Delivery not found" });

    res.json(delivery);
  } catch (error) {
    res.status(500).json({ message: "Error fetching delivery tracking" });
  }
};

/**
 * GET /api/deliveries
 */
export const getAllDeliveries = async (req, res) => {
  try {
    const deliveries = await Delivery.find()
      .populate("assignedDriver", "name email")
      .populate("assignedVehicle", "name plateNumber status")
      .populate("customer", "name email");

    res.json(deliveries);
  } catch (error) {
    res.status(500).json({ message: "Error fetching deliveries" });
  }
};

/**
 * POST /api/deliveries/customer/book
 * Customer creates a booking request
 */
export const createCustomerBooking = async (req, res) => {
  try {
    const {
      pickupLocation,
      dropLocation,
      packageDetails,
      preferredDate,
      preferredTime,
      contactNumber,
      specialInstructions,
      estimatedDistance
    } = req.body;

    console.log("=== CREATE CUSTOMER BOOKING ===");
    console.log("Customer ID:", req.user._id);
    console.log("Pickup:", pickupLocation);
    console.log("Drop:", dropLocation);
    console.log("Package:", packageDetails);
    console.log("Estimated Distance:", estimatedDistance);

    // Customer ID from authenticated user
    const customerId = req.user._id;

    // Validation
    if (!pickupLocation?.address || !dropLocation?.address) {
      return res.status(400).json({ message: "Pickup and drop locations are required." });
    }

    if (!packageDetails?.weight || parseFloat(packageDetails.weight) <= 0) {
      return res.status(400).json({ message: "Valid package weight is required." });
    }

    if (!estimatedDistance || parseFloat(estimatedDistance) <= 0) {
      return res.status(400).json({ message: "Valid estimated distance is required." });
    }

    if (!contactNumber) {
      return res.status(400).json({ message: "Contact number is required." });
    }

    // Create booking
    const booking = new Delivery({
      pickupLocation,
      dropLocation,
      customer: customerId,
      packageDetails,
      preferredDate,
      preferredTime,
      contactNumber,
      specialInstructions,
      estimatedDistance: parseFloat(estimatedDistance),
      status: "Pending",
    });
    
    console.log("Calculating pricing...");
    // Calculate pricing based on weight, distance, and cluster
    booking.calculatePricing();
    console.log("Total Price:", booking.pricing.totalPrice);
    
    await booking.save();
    console.log("Booking saved:", booking.deliveryId);

    const populatedBooking = await Delivery.findById(booking._id)
      .populate("customer", "name email");

    console.log("=== BOOKING CREATED SUCCESSFULLY ===");

    res.status(201).json({
      success: true,
      message: "Booking created successfully! Please proceed to payment.",
      delivery: populatedBooking
    });
  } catch (error) {
    console.error("=== BOOKING ERROR ===");
    console.error(error);
    res.status(500).json({ 
      success: false,
      message: "Failed to create booking",
      error: error.message 
    });
  }
};

/**
 * GET /api/deliveries/customer/my-bookings
 * Get all bookings for the logged-in customer
 */
export const getCustomerBookings = async (req, res) => {
  try {
    const customerId = req.user._id;

    const bookings = await Delivery.find({ customer: customerId })
      .populate("assignedDriver", "name email")
      .populate("assignedVehicle", "name plateNumber type status")
      .sort({ createdAt: -1 });

    res.json(bookings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching bookings" });
  }
};

/**
 * GET /api/deliveries/customer/:id
 * Get a specific booking by ID (customer can only access their own)
 */
export const getCustomerBookingById = async (req, res) => {
  try {
    const { id } = req.params;
    const customerId = req.user._id;

    const booking = await Delivery.findOne({ _id: id, customer: customerId })
      .populate("assignedDriver", "name email")
      .populate("assignedVehicle", "name plateNumber type status")
      .populate("customer", "name email");

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    res.json(booking);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching booking" });
  }
};

/**
 * PUT /api/deliveries/customer/:id/cancel
 * Customer cancels their booking
 */
export const cancelCustomerBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const customerId = req.user._id;

    const booking = await Delivery.findOne({ _id: id, customer: customerId });

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (booking.status === "Delivered" || booking.status === "Cancelled") {
      return res.status(400).json({ message: "Cannot cancel this booking" });
    }

    booking.status = "Cancelled";
    booking.addStatusUpdate("Cancelled", customerId, "Cancelled by customer");
    await booking.save();

    // Free up vehicle if assigned
    if (booking.assignedVehicle) {
      await Vehicle.findByIdAndUpdate(booking.assignedVehicle, { status: "Available" });
    }

    res.json({ message: "Booking cancelled successfully", booking });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to cancel booking" });
  }
};

/**
 * PUT /api/deliveries/:id/approve
 * Admin approves a delivery booking
 */
export const approveDelivery = async (req, res) => {
  try {
    const { id } = req.params;

    const delivery = await Delivery.findById(id);
    if (!delivery) {
      return res.status(404).json({ message: "Delivery not found" });
    }

    delivery.adminApproved = true;
    delivery.status = "Approved";
    await delivery.save();

    const populated = await Delivery.findById(id)
      .populate("customer", "name email")
      .populate("assignedDriver", "name email")
      .populate("assignedVehicle", "name plateNumber");

    // Emit Socket.IO event for real-time updates
    if (global.io) {
      global.io.to(`delivery_${id}`).emit('statusUpdate', {
        deliveryId: id,
        status: "Approved",
        timestamp: new Date()
      });
      console.log(`📡 Approval emitted for delivery ${id}`);
    }

    res.json({ message: "Delivery approved successfully", delivery: populated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to approve delivery" });
  }
};

/**
 * PUT /api/deliveries/:id/assign
 * Admin assigns driver and vehicle to approved delivery
 */
export const assignDelivery = async (req, res) => {
  try {
    const { id } = req.params;
    const { driverId, vehicleId, estimatedDistance, estimatedDuration } = req.body;

    console.log("=== ASSIGN DELIVERY REQUEST ===");
    console.log("Delivery ID:", id);
    console.log("Driver ID:", driverId);
    console.log("Vehicle ID:", vehicleId);
    console.log("Distance:", estimatedDistance);
    console.log("Duration:", estimatedDuration);

    // Validate required fields
    if (!driverId || !vehicleId) {
      return res.status(400).json({ 
        message: "Driver and vehicle are required",
        missing: {
          driver: !driverId,
          vehicle: !vehicleId
        }
      });
    }

    if (!estimatedDistance || parseFloat(estimatedDistance) <= 0) {
      return res.status(400).json({ 
        message: "Valid estimated distance is required for pricing calculation" 
      });
    }

    // Find delivery
    const delivery = await Delivery.findById(id);
    if (!delivery) {
      return res.status(404).json({ message: "Delivery not found" });
    }

    console.log("Delivery found:", delivery.deliveryId);
    console.log("Current status:", delivery.status);
    console.log("Admin approved:", delivery.adminApproved);

    // Check if delivery is approved
    if (!delivery.adminApproved) {
      return res.status(400).json({ 
        message: "Delivery must be approved first. Please approve the delivery before assigning." 
      });
    }

    // Verify driver exists and is active
    const driver = await User.findById(driverId);
    if (!driver || driver.role !== "Driver") {
      return res.status(400).json({ message: "Invalid driver selected" });
    }
    if (!driver.isActive) {
      return res.status(400).json({ message: "Selected driver is not active" });
    }

    // Verify vehicle exists
    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) {
      return res.status(400).json({ message: "Invalid vehicle selected" });
    }

    console.log("Driver verified:", driver.name);
    console.log("Vehicle verified:", vehicle.name);

    // Free up previous vehicle if reassigning
    if (delivery.assignedVehicle && delivery.assignedVehicle.toString() !== vehicleId) {
      console.log("Freeing previous vehicle:", delivery.assignedVehicle);
      await Vehicle.findByIdAndUpdate(delivery.assignedVehicle, { status: "Available" });
    }

    // Reset rejection status if reassigning after rejection
    if (delivery.status === "Rejected") {
      console.log("Resetting rejection status");
      delivery.driverRejectedReason = undefined;
    }

    // Update delivery
    delivery.assignedDriver = driverId;
    delivery.assignedVehicle = vehicleId;
    delivery.estimatedDistance = parseFloat(estimatedDistance);
    delivery.estimatedDuration = parseInt(estimatedDuration) || 30;
    delivery.status = "Assigned";
    delivery.driverAccepted = false; // Reset acceptance
    
    // Recalculate pricing with distance
    console.log("Calculating pricing...");
    delivery.calculatePricing();
    console.log("Total price:", delivery.pricing.totalPrice);
    
    // Add to status history
    delivery.addStatusUpdate("Assigned", req.user._id, `Assigned to ${driver.name} with ${vehicle.name}`);
    
    await delivery.save();
    console.log("Delivery saved successfully");

    // Update vehicle status
    await Vehicle.findByIdAndUpdate(vehicleId, { status: "Assigned" });
    console.log("Vehicle status updated to Assigned");

    // Populate and return
    const populated = await Delivery.findById(id)
      .populate("customer", "name email phone")
      .populate("assignedDriver", "name email phone")
      .populate("assignedVehicle", "name plateNumber type status");

    console.log("=== ASSIGNMENT SUCCESSFUL ===");

    // Emit Socket.IO event for real-time updates
    if (global.io) {
      global.io.to(`delivery_${id}`).emit('statusUpdate', {
        deliveryId: id,
        status: "Assigned",
        driver: driver.name,
        vehicle: vehicle.name,
        timestamp: new Date()
      });
      console.log(`📡 Assignment emitted for delivery ${id}`);
    }

    res.json({ 
      success: true,
      message: "Delivery assigned successfully", 
      delivery: populated 
    });
  } catch (error) {
    console.error("=== ASSIGN DELIVERY ERROR ===");
    console.error(error);
    res.status(500).json({ 
      success: false,
      message: "Failed to assign delivery",
      error: error.message 
    });
  }
};

/**
 * PUT /api/deliveries/:id/accept
 * Driver accepts assigned delivery
 */
export const acceptDelivery = async (req, res) => {
  try {
    const { id } = req.params;
    const driverId = req.user._id;

    const delivery = await Delivery.findById(id);
    if (!delivery) {
      return res.status(404).json({ message: "Delivery not found" });
    }

    if (delivery.assignedDriver.toString() !== driverId.toString()) {
      return res.status(403).json({ message: "This delivery is not assigned to you" });
    }

    if (delivery.status !== "Assigned") {
      return res.status(400).json({ message: "Delivery cannot be accepted in current status" });
    }

    delivery.driverAccepted = true;
    delivery.status = "Accepted";
    await delivery.save();

    // Update vehicle to On Route
    await Vehicle.findByIdAndUpdate(delivery.assignedVehicle, { status: "On Route" });

    const populated = await Delivery.findById(id)
      .populate("customer", "name email")
      .populate("assignedDriver", "name email")
      .populate("assignedVehicle", "name plateNumber type");

    // Emit Socket.IO event
    if (global.io) {
      global.io.to(`delivery_${id}`).emit('statusUpdate', {
        deliveryId: id,
        status: "Accepted",
        timestamp: new Date()
      });
      console.log(`📡 Acceptance emitted for delivery ${id}`);
    }

    res.json({ message: "Delivery accepted successfully", delivery: populated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to accept delivery" });
  }
};

/**
 * PUT /api/deliveries/:id/reject
 * Driver rejects assigned delivery
 */
export const rejectDelivery = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const driverId = req.user._id;

    const delivery = await Delivery.findById(id);
    if (!delivery) {
      return res.status(404).json({ message: "Delivery not found" });
    }

    if (delivery.assignedDriver.toString() !== driverId.toString()) {
      return res.status(403).json({ message: "This delivery is not assigned to you" });
    }

    delivery.driverAccepted = false;
    delivery.driverRejectedReason = reason || "No reason provided";
    delivery.status = "Rejected";
    delivery.assignedDriver = null;
    delivery.assignedVehicle = null;
    await delivery.save();

    // Emit Socket.IO event
    if (global.io) {
      global.io.to(`delivery_${id}`).emit('statusUpdate', {
        deliveryId: id,
        status: "Rejected",
        reason,
        timestamp: new Date()
      });
      console.log(`📡 Rejection emitted for delivery ${id}`);
    }

    res.json({ message: "Delivery rejected", delivery });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to reject delivery" });
  }
};

/**
 * GET /api/deliveries/driver/assigned
 * Get deliveries assigned to the logged-in driver
 */
export const getDriverAssignedDeliveries = async (req, res) => {
  try {
    const driverId = req.user._id;

    const deliveries = await Delivery.find({ assignedDriver: driverId })
      .populate("customer", "name email contactNumber")
      .populate("assignedVehicle", "name plateNumber type")
      .sort({ createdAt: -1 });

    res.json(deliveries);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching assigned deliveries" });
  }
};

/**
 * DELETE /api/deliveries/:id
 * Delete a delivery (Admin only)
 */
export const deleteDelivery = async (req, res) => {
  try {
    const { id } = req.params;

    const delivery = await Delivery.findById(id);
    if (!delivery) {
      return res.status(404).json({ message: "Delivery not found" });
    }

    // Free up vehicle if assigned
    if (delivery.assignedVehicle) {
      await Vehicle.findByIdAndUpdate(delivery.assignedVehicle, { status: "Available" });
    }

    await Delivery.findByIdAndDelete(id);

    res.json({ message: "Delivery deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to delete delivery" });
  }
};

/**
 * PUT /api/deliveries/:id/start
 * Driver starts the delivery
 */
export const startDelivery = async (req, res) => {
  try {
    const { id } = req.params;
    const driverId = req.user._id;

    const delivery = await Delivery.findById(id);
    if (!delivery) {
      return res.status(404).json({ message: "Delivery not found" });
    }

    if (delivery.assignedDriver.toString() !== driverId.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    delivery.status = "On Route";
    delivery.startTime = new Date();
    delivery.addStatusUpdate("On Route", driverId, "Driver started the delivery");
    await delivery.save();

    await Vehicle.findByIdAndUpdate(delivery.assignedVehicle, { status: "On Route" });

    res.json({ message: "Delivery started", delivery });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to start delivery" });
  }
};

/**
 * PUT /api/deliveries/:id/complete
 * Driver completes the delivery
 */
export const completeDelivery = async (req, res) => {
  try {
    const { id } = req.params;
    const driverId = req.user._id;

    const delivery = await Delivery.findById(id);
    if (!delivery) {
      return res.status(404).json({ message: "Delivery not found" });
    }

    if (delivery.assignedDriver.toString() !== driverId.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    delivery.status = "Delivered";
    delivery.endTime = new Date();
    delivery.paymentStatus = "Paid";
    delivery.addStatusUpdate("Delivered", driverId, "Delivery completed successfully");
    
    // Credit driver wallet
    const driver = await User.findById(driverId);
    if (driver && driver.driverProfile) {
      const earnings = delivery.driverEarnings.netEarnings;
      driver.driverProfile.wallet.balance += earnings;
      driver.driverProfile.wallet.totalEarnings += earnings;
      driver.driverProfile.wallet.transactions.push({
        type: "Credit",
        amount: earnings,
        description: `Delivery ${delivery.deliveryId} completed`,
        deliveryId: delivery.deliveryId,
        timestamp: new Date(),
        balanceAfter: driver.driverProfile.wallet.balance
      });
      
      // Update performance
      driver.driverProfile.performance.completedTrips += 1;
      driver.driverProfile.performance.totalTrips += 1;
      
      await driver.save();
    }
    
    // Mark driver earnings as paid
    delivery.driverEarnings.paidToDriver = true;
    delivery.driverEarnings.paidAt = new Date();
    
    await delivery.save();

    // Update vehicle status
    await Vehicle.findByIdAndUpdate(delivery.assignedVehicle, { status: "Available" });

    res.json({ message: "Delivery completed successfully", delivery });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to complete delivery" });
  }
};

/**
 * PUT /api/deliveries/:id/location
 * Update real-time location during delivery
 */
export const updateDeliveryLocation = async (req, res) => {
  try {
    const { id } = req.params;
    const { lat, lng } = req.body;
    const driverId = req.user._id;

    const delivery = await Delivery.findById(id);
    if (!delivery) {
      return res.status(404).json({ message: "Delivery not found" });
    }

    if (delivery.assignedDriver.toString() !== driverId.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    delivery.currentLocation = {
      lat,
      lng,
      lastUpdated: new Date()
    };
    await delivery.save();

    // Also update vehicle location
    await Vehicle.findByIdAndUpdate(delivery.assignedVehicle, {
      "currentLocation.lat": lat,
      "currentLocation.lng": lng,
      "currentLocation.lastUpdated": new Date()
    });

    res.json({ message: "Location updated", location: delivery.currentLocation });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to update location" });
  }
};

/**
 * POST /api/deliveries/:id/rate
 * Customer rates and provides feedback after delivery
 */
export const rateDelivery = async (req, res) => {
  try {
    const { id } = req.params;
    const { stars, feedback, categories, tags } = req.body;
    const customerId = req.user._id;

    const delivery = await Delivery.findOne({ _id: id, customer: customerId });
    if (!delivery) {
      return res.status(404).json({ message: "Delivery not found" });
    }

    if (delivery.status !== "Delivered") {
      return res.status(400).json({ message: "Can only rate completed deliveries" });
    }

    if (delivery.rating && delivery.rating.stars) {
      return res.status(400).json({ message: "Delivery already rated" });
    }

    // Update delivery rating
    delivery.rating = {
      stars,
      feedback,
      ratedAt: new Date()
    };
    await delivery.save();

    // Create feedback record for admin
    const feedbackRecord = await Feedback.create({
      delivery: delivery._id,
      customer: customerId,
      driver: delivery.assignedDriver,
      rating: {
        stars,
        categories: categories || {}
      },
      feedback,
      tags: tags || []
    });

    // Update driver ratings
    const driver = await User.findById(delivery.assignedDriver);
    if (driver && driver.driverProfile) {
      driver.driverProfile.ratings.push({
        deliveryId: delivery._id,
        stars,
        feedback,
        customerId,
        createdAt: new Date()
      });
      
      // Recalculate average rating
      const allRatings = driver.driverProfile.ratings;
      const avgRating = allRatings.reduce((sum, r) => sum + r.stars, 0) / allRatings.length;
      driver.driverProfile.performance.averageRating = avgRating;
      
      await driver.save();
    }

    res.json({ message: "Thank you for your feedback!", rating: delivery.rating });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to submit rating" });
  }
};

/**
 * PUT /api/deliveries/:id/cancel-advanced
 * Enhanced cancellation with refund and status reversal
 */
export const cancelDeliveryAdvanced = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user._id;
    const userRole = req.user.role;

    const delivery = await Delivery.findById(id);
    if (!delivery) {
      return res.status(404).json({ message: "Delivery not found" });
    }

    // Check authorization
    if (userRole === "Customer" && delivery.customer.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    if (["Delivered", "Cancelled"].includes(delivery.status)) {
      return res.status(400).json({ message: "Cannot cancel this delivery" });
    }

    // Calculate refund amount based on status
    let refundPercentage = 1.0;
    if (delivery.status === "Assigned") refundPercentage = 0.9;
    else if (delivery.status === "Accepted") refundPercentage = 0.8;
    else if (delivery.status === "On Route") refundPercentage = 0.5;

    const refundAmount = delivery.pricing.totalPrice * refundPercentage;

    // Update delivery
    delivery.status = "Cancelled";
    delivery.cancellation = {
      cancelledBy: userId,
      cancelledAt: new Date(),
      reason: reason || "No reason provided",
      refundAmount,
      refundStatus: "Pending"
    };
    delivery.addStatusUpdate("Cancelled", userId, `Cancelled: ${reason}`);
    await delivery.save();

    // Process refund to customer wallet
    if (refundAmount > 0) {
      const customer = await User.findById(delivery.customer);
      if (customer) {
        customer.customerWallet.balance += refundAmount;
        customer.customerWallet.transactions.push({
          type: "Refund",
          amount: refundAmount,
          description: `Refund for cancelled delivery ${delivery.deliveryId}`,
          deliveryId: delivery.deliveryId,
          timestamp: new Date(),
          balanceAfter: customer.customerWallet.balance
        });
        await customer.save();
      }
      delivery.cancellation.refundStatus = "Processed";
      await delivery.save();
    }

    // Free up resources
    if (delivery.assignedVehicle) {
      await Vehicle.findByIdAndUpdate(delivery.assignedVehicle, { status: "Available" });
    }

    // Update driver status if assigned
    if (delivery.assignedDriver) {
      const driver = await User.findById(delivery.assignedDriver);
      if (driver && driver.driverProfile) {
        driver.driverProfile.performance.cancelledTrips += 1;
        driver.driverProfile.status = "Active";
        await driver.save();
      }
    }

    res.json({ 
      message: "Delivery cancelled successfully", 
      delivery,
      refundAmount 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to cancel delivery" });
  }
};

/**
 * GET /api/deliveries/search
 * Search deliveries with filters
 */
export const searchDeliveries = async (req, res) => {
  try {
    const { query, status, startDate, endDate, customerId, driverId } = req.query;
    const userRole = req.user.role;
    const userId = req.user._id;

    let filter = {};

    // Role-based filtering
    if (userRole === "Customer") {
      filter.customer = userId;
    } else if (userRole === "Driver") {
      filter.assignedDriver = userId;
    }

    // Additional filters
    if (status) filter.status = status;
    if (customerId && userRole === "Admin") filter.customer = customerId;
    if (driverId && userRole === "Admin") filter.assignedDriver = driverId;
    
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    // Text search
    if (query) {
      filter.$or = [
        { deliveryId: { $regex: query, $options: "i" } },
        { "pickupLocation.address": { $regex: query, $options: "i" } },
        { "dropLocation.address": { $regex: query, $options: "i" } },
        { "packageDetails.description": { $regex: query, $options: "i" } }
      ];
    }

    const deliveries = await Delivery.find(filter)
      .populate("customer", "name email")
      .populate("assignedDriver", "name email")
      .populate("assignedVehicle", "name plateNumber type")
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(deliveries);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Search failed" });
  }
};

/**
 * GET /api/deliveries/stats
 * Get delivery statistics for dashboards
 */
export const getDeliveryStats = async (req, res) => {
  try {
    const userRole = req.user.role;
    const userId = req.user._id;

    let filter = {};
    if (userRole === "Customer") filter.customer = userId;
    else if (userRole === "Driver") filter.assignedDriver = userId;

    const stats = {
      total: await Delivery.countDocuments(filter),
      pending: await Delivery.countDocuments({ ...filter, status: "Pending" }),
      assigned: await Delivery.countDocuments({ ...filter, status: "Assigned" }),
      onRoute: await Delivery.countDocuments({ ...filter, status: "On Route" }),
      delivered: await Delivery.countDocuments({ ...filter, status: "Delivered" }),
      cancelled: await Delivery.countDocuments({ ...filter, status: "Cancelled" })
    };

    // Calculate revenue for drivers
    if (userRole === "Driver") {
      const deliveries = await Delivery.find({ 
        ...filter, 
        status: "Delivered",
        "driverEarnings.paidToDriver": true 
      });
      stats.totalEarnings = deliveries.reduce((sum, d) => sum + d.driverEarnings.netEarnings, 0);
    }

    res.json(stats);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to get stats" });
  }
};

