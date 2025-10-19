import User from "../models/User.js";
import Delivery from "../models/Delivery.js";

/**
 * GET /api/users/drivers
 * Get all drivers with status filtering
 */
export const getAllDrivers = async (req, res) => {
  try {
    const { status, search } = req.query;
    const filter = { role: "Driver" };

    if (status) {
      filter["driverProfile.status"] = status;
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } }
      ];
    }

    const drivers = await User.find(filter)
      .select("-password")
      .populate("driverProfile.assignedVehicles", "name plateNumber type status");

    res.json(drivers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch drivers" });
  }
};

/**
 * GET /api/users/drivers/:id
 * Get driver details
 */
export const getDriverById = async (req, res) => {
  try {
    const { id } = req.params;

    const driver = await User.findOne({ _id: id, role: "Driver" })
      .select("-password")
      .populate("driverProfile.assignedVehicles");

    if (!driver) {
      return res.status(404).json({ message: "Driver not found" });
    }

    // Get delivery stats
    const deliveryStats = {
      total: await Delivery.countDocuments({ assignedDriver: id }),
      completed: await Delivery.countDocuments({ assignedDriver: id, status: "Delivered" }),
      active: await Delivery.countDocuments({ 
        assignedDriver: id, 
        status: { $in: ["Assigned", "Accepted", "On Route"] }
      }),
      cancelled: await Delivery.countDocuments({ assignedDriver: id, status: "Cancelled" })
    };

    res.json({ driver, deliveryStats });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch driver" });
  }
};

/**
 * PUT /api/users/drivers/:id/status
 * Update driver status (Admin only)
 */
export const updateDriverStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const driver = await User.findOne({ _id: id, role: "Driver" });
    if (!driver) {
      return res.status(404).json({ message: "Driver not found" });
    }

    if (!driver.driverProfile) {
      return res.status(400).json({ message: "Invalid driver profile" });
    }

    driver.driverProfile.status = status;
    driver.isActive = status === "Active";
    await driver.save();

    res.json({ message: "Driver status updated", driver });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to update driver status" });
  }
};

/**
 * GET /api/users/drivers/stats/overview
 * Get drivers overview stats (Admin)
 */
export const getDriversOverview = async (req, res) => {
  try {
    const total = await User.countDocuments({ role: "Driver" });
    const active = await User.countDocuments({ 
      role: "Driver", 
      "driverProfile.status": "Active" 
    });
    const inactive = await User.countDocuments({ 
      role: "Driver", 
      "driverProfile.status": "Inactive" 
    });
    const onLeave = await User.countDocuments({ 
      role: "Driver", 
      "driverProfile.status": "On Leave" 
    });
    const suspended = await User.countDocuments({ 
      role: "Driver", 
      "driverProfile.status": "Suspended" 
    });

    // Get drivers currently on delivery
    const onDelivery = await Delivery.distinct("assignedDriver", {
      status: { $in: ["Accepted", "On Route"] }
    });

    res.json({
      total,
      active,
      inactive,
      onLeave,
      suspended,
      onDelivery: onDelivery.length,
      available: active - onDelivery.length
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to get drivers overview" });
  }
};

/**
 * GET /api/users/profile
 * Get current user profile
 */
export const getUserProfile = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId)
      .select("-password")
      .populate("driverProfile.assignedVehicles");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch profile" });
  }
};

/**
 * PUT /api/users/profile
 * Update user profile
 */
export const updateUserProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const { name, email, phone, licenseNumber, vehicleType, ...otherUpdates } = req.body;

    console.log("=== UPDATE USER PROFILE ===");
    console.log("User ID:", userId);
    console.log("Request body:", req.body);

    // Prevent updating sensitive fields
    delete otherUpdates.password;
    delete otherUpdates.role;
    delete otherUpdates._id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    console.log("User role:", user.role);

    // Update basic fields
    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;
    if (phone !== undefined) user.phone = phone;

    // Update driver-specific fields if user is a driver
    if (user.role === "Driver") {
      // Initialize driverProfile if it doesn't exist
      if (!user.driverProfile) {
        user.driverProfile = {};
      }
      
      if (licenseNumber !== undefined) {
        user.driverProfile.licenseNumber = licenseNumber;
      }
      if (vehicleType !== undefined) {
        user.driverProfile.vehicleType = vehicleType;
      }
      
      console.log("Updated driverProfile:", user.driverProfile);
    }

    // Apply any other updates
    Object.keys(otherUpdates).forEach(key => {
      if (otherUpdates[key] !== undefined) {
        user[key] = otherUpdates[key];
      }
    });

    await user.save();
    console.log("Profile saved successfully");

    // Return user without password
    const updatedUser = await User.findById(userId).select("-password");
    console.log("=== UPDATE SUCCESS ===");
    res.json(updatedUser);
  } catch (error) {
    console.error("=== UPDATE ERROR ===");
    console.error(error);
    res.status(500).json({ 
      message: "Failed to update profile",
      error: error.message 
    });
  }
};

/**
 * GET /api/users/wallet
 * Get wallet information
 */
export const getWallet = async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;

    const user = await User.findById(userId).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let wallet;
    if (userRole === "Driver" && user.driverProfile) {
      wallet = user.driverProfile.wallet;
    } else if (userRole === "Customer") {
      wallet = user.customerWallet;
    } else {
      return res.status(400).json({ message: "Wallet not available for this user type" });
    }

    res.json(wallet);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch wallet" });
  }
};

/**
 * POST /api/users/wallet/withdraw
 * Driver withdraws earnings
 */
export const withdrawEarnings = async (req, res) => {
  try {
    const userId = req.user._id;
    const { amount } = req.body;

    const driver = await User.findOne({ _id: userId, role: "Driver" });
    if (!driver || !driver.driverProfile) {
      return res.status(404).json({ message: "Driver not found" });
    }

    if (amount <= 0) {
      return res.status(400).json({ message: "Invalid amount" });
    }

    if (driver.driverProfile.wallet.balance < amount) {
      return res.status(400).json({ message: "Insufficient balance" });
    }

    driver.driverProfile.wallet.balance -= amount;
    driver.driverProfile.wallet.transactions.push({
      type: "Withdrawal",
      amount: -amount,
      description: "Withdrawal to bank account",
      timestamp: new Date(),
      balanceAfter: driver.driverProfile.wallet.balance
    });

    await driver.save();

    res.json({ 
      message: "Withdrawal successful", 
      newBalance: driver.driverProfile.wallet.balance 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Withdrawal failed" });
  }
};

/**
 * GET /api/users/drivers/:id/earnings
 * Get driver earnings analytics
 */
export const getDriverEarnings = async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    const driver = await User.findOne({ _id: id, role: "Driver" });
    if (!driver) {
      return res.status(404).json({ message: "Driver not found" });
    }

    const filter = {
      assignedDriver: id,
      status: "Delivered",
      "driverEarnings.paidToDriver": true
    };

    if (startDate || endDate) {
      filter.endTime = {};
      if (startDate) filter.endTime.$gte = new Date(startDate);
      if (endDate) filter.endTime.$lte = new Date(endDate);
    }

    const deliveries = await Delivery.find(filter).sort({ endTime: -1 });

    const analytics = {
      totalEarnings: deliveries.reduce((sum, d) => sum + d.driverEarnings.netEarnings, 0),
      totalDeliveries: deliveries.length,
      averageEarningPerDelivery: deliveries.length > 0 
        ? deliveries.reduce((sum, d) => sum + d.driverEarnings.netEarnings, 0) / deliveries.length 
        : 0,
      currentBalance: driver.driverProfile?.wallet?.balance || 0,
      totalWithdrawn: driver.driverProfile?.wallet?.totalEarnings - driver.driverProfile?.wallet?.balance || 0,
      recentDeliveries: deliveries.slice(0, 10),
      earningsByMonth: {}
    };

    // Group earnings by month
    deliveries.forEach(delivery => {
      const month = new Date(delivery.endTime).toISOString().slice(0, 7); // YYYY-MM
      if (!analytics.earningsByMonth[month]) {
        analytics.earningsByMonth[month] = {
          earnings: 0,
          deliveries: 0
        };
      }
      analytics.earningsByMonth[month].earnings += delivery.driverEarnings.netEarnings;
      analytics.earningsByMonth[month].deliveries += 1;
    });

    res.json(analytics);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to get earnings" });
  }
};

/**
 * GET /api/users/search
 * Search users (Admin only)
 */
export const searchUsers = async (req, res) => {
  try {
    const { query, role } = req.query;
    const filter = {};

    if (role) filter.role = role;

    if (query) {
      filter.$or = [
        { name: { $regex: query, $options: "i" } },
        { email: { $regex: query, $options: "i" } },
        { phone: { $regex: query, $options: "i" } }
      ];
    }

    const users = await User.find(filter)
      .select("-password")
      .limit(50);

    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Search failed" });
  }
};
