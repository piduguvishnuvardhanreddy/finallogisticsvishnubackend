import User from "../models/User.js";
import Delivery from "../models/Delivery.js";

/**
 * POST /api/wallet/customer/add-money
 * Customer adds money to wallet
 */
export const addMoneyToCustomerWallet = async (req, res) => {
  try {
    const { amount, paymentMethod } = req.body;
    const customerId = req.user._id;

    console.log("=== ADD MONEY TO CUSTOMER WALLET ===");
    console.log("Customer ID:", customerId);
    console.log("Amount:", amount);
    console.log("Payment Method:", paymentMethod);
    console.log("User role:", req.user.role);

    // Validation
    if (!amount || parseFloat(amount) <= 0) {
      console.log("Invalid amount provided");
      return res.status(400).json({ 
        success: false,
        message: "Valid amount is required" 
      });
    }

    const amountToAdd = parseFloat(amount);

    // Find customer
    const customer = await User.findById(customerId);
    if (!customer) {
      console.log("Customer not found");
      return res.status(404).json({ 
        success: false,
        message: "Customer not found" 
      });
    }

    console.log("Customer found:", customer.name);

    // Initialize wallet if not exists
    if (!customer.customerWallet) {
      console.log("Initializing customer wallet");
      customer.customerWallet = { balance: 0, transactions: [] };
    }

    // Add money to wallet
    const previousBalance = customer.customerWallet.balance || 0;
    customer.customerWallet.balance = previousBalance + amountToAdd;

    console.log("Previous balance:", previousBalance);
    console.log("New balance:", customer.customerWallet.balance);

    // Add transaction record
    customer.customerWallet.transactions.push({
      type: "Credit",
      amount: amountToAdd,
      description: `Money added via ${paymentMethod || "Payment Gateway"}`,
      timestamp: new Date(),
      balanceAfter: customer.customerWallet.balance
    });

    await customer.save();

    console.log("Money added successfully");
    console.log("Transaction count:", customer.customerWallet.transactions.length);
    console.log("=== ADD MONEY SUCCESS ===");

    res.json({
      success: true,
      message: "Money added to wallet successfully",
      wallet: {
        balance: customer.customerWallet.balance,
        amountAdded: amountToAdd
      }
    });
  } catch (error) {
    console.error("=== ADD MONEY ERROR ===");
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    res.status(500).json({
      success: false,
      message: "Failed to add money to wallet",
      error: error.message
    });
  }
};

/**
 * GET /api/wallet/customer/balance
 * Get customer wallet balance
 */
export const getCustomerWalletBalance = async (req, res) => {
  try {
    const customerId = req.user._id;

    const customer = await User.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    const balance = customer.customerWallet?.balance || 0;
    const transactions = customer.customerWallet?.transactions || [];

    res.json({
      success: true,
      balance,
      transactions: transactions.slice(-10).reverse() // Last 10 transactions
    });
  } catch (error) {
    console.error("Error fetching wallet balance:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch wallet balance",
      error: error.message
    });
  }
};

/**
 * POST /api/wallet/customer/pay-delivery
 * Customer pays for delivery using wallet
 */
export const payDeliveryWithWallet = async (req, res) => {
  try {
    const { deliveryId } = req.body;
    const customerId = req.user._id;

    console.log("=== PAY DELIVERY WITH WALLET ===");
    console.log("Customer ID:", customerId);
    console.log("Delivery ID:", deliveryId);

    // Find delivery
    const delivery = await Delivery.findById(deliveryId);
    if (!delivery) {
      return res.status(404).json({ message: "Delivery not found" });
    }

    // Check if delivery belongs to customer
    if (delivery.customer.toString() !== customerId.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // Check if already paid
    if (delivery.paymentStatus === "Paid") {
      return res.status(400).json({ message: "Delivery already paid" });
    }

    const totalPrice = delivery.pricing?.totalPrice || 0;
    console.log("Total price:", totalPrice);

    // Find customer
    const customer = await User.findById(customerId);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    // Initialize wallet if not exists
    if (!customer.customerWallet) {
      customer.customerWallet = { balance: 0, transactions: [] };
    }

    const walletBalance = customer.customerWallet.balance || 0;
    console.log("Wallet balance:", walletBalance);

    // Check if sufficient balance
    if (walletBalance < totalPrice) {
      console.log("Insufficient balance");
      return res.status(400).json({
        success: false,
        message: "Insufficient wallet balance",
        required: totalPrice,
        available: walletBalance,
        shortfall: totalPrice - walletBalance
      });
    }

    // Deduct from customer wallet
    customer.customerWallet.balance = walletBalance - totalPrice;
    customer.customerWallet.transactions.push({
      type: "Debit",
      amount: totalPrice,
      description: `Payment for delivery ${delivery.deliveryId}`,
      deliveryId: delivery.deliveryId,
      timestamp: new Date(),
      balanceAfter: customer.customerWallet.balance
    });

    await customer.save();

    // Update delivery payment status
    delivery.paymentStatus = "Paid";
    delivery.paymentMethod = "Wallet";
    delivery.paidAt = new Date();
    await delivery.save();

    // Add money to admin wallet
    const admin = await User.findOne({ role: "Admin" });
    if (admin) {
      if (!admin.adminWallet) {
        admin.adminWallet = { balance: 0, totalRevenue: 0, transactions: [] };
      }

      admin.adminWallet.balance = (admin.adminWallet.balance || 0) + totalPrice;
      admin.adminWallet.totalRevenue = (admin.adminWallet.totalRevenue || 0) + totalPrice;
      admin.adminWallet.transactions.push({
        type: "Credit",
        amount: totalPrice,
        description: `Payment received for delivery ${delivery.deliveryId}`,
        deliveryId: delivery.deliveryId,
        timestamp: new Date(),
        balanceAfter: admin.adminWallet.balance
      });

      await admin.save();
      console.log("Payment added to admin wallet");
    }

    console.log("Payment successful");
    console.log("New customer balance:", customer.customerWallet.balance);
    console.log("=== PAYMENT SUCCESS ===");

    res.json({
      success: true,
      message: "Payment successful",
      delivery: {
        id: delivery._id,
        deliveryId: delivery.deliveryId,
        paymentStatus: delivery.paymentStatus,
        paidAmount: totalPrice
      },
      wallet: {
        balance: customer.customerWallet.balance
      }
    });
  } catch (error) {
    console.error("=== PAYMENT ERROR ===");
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Payment failed",
      error: error.message
    });
  }
};

/**
 * GET /api/wallet/driver/balance
 * Get driver wallet balance
 */
export const getDriverWalletBalance = async (req, res) => {
  try {
    const driverId = req.user._id;

    const driver = await User.findById(driverId);
    if (!driver) {
      return res.status(404).json({ message: "Driver not found" });
    }

    const wallet = driver.driverProfile?.wallet || { balance: 0, totalEarnings: 0, transactions: [] };

    res.json({
      success: true,
      balance: wallet.balance || 0,
      totalEarnings: wallet.totalEarnings || 0,
      pendingEarnings: wallet.pendingEarnings || 0,
      transactions: (wallet.transactions || []).slice(-20).reverse()
    });
  } catch (error) {
    console.error("Error fetching driver wallet:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch wallet balance",
      error: error.message
    });
  }
};

/**
 * POST /api/wallet/driver/withdraw
 * Driver withdraws money from wallet
 */
export const withdrawDriverEarnings = async (req, res) => {
  try {
    const { amount, bankDetails } = req.body;
    const driverId = req.user._id;

    console.log("=== DRIVER WITHDRAWAL REQUEST ===");
    console.log("Driver ID:", driverId);
    console.log("Amount:", amount);

    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ message: "Valid amount is required" });
    }

    const withdrawAmount = parseFloat(amount);

    const driver = await User.findById(driverId);
    if (!driver) {
      return res.status(404).json({ message: "Driver not found" });
    }

    const wallet = driver.driverProfile?.wallet || { balance: 0, transactions: [] };
    const currentBalance = wallet.balance || 0;

    if (currentBalance < withdrawAmount) {
      return res.status(400).json({
        success: false,
        message: "Insufficient balance",
        available: currentBalance,
        requested: withdrawAmount
      });
    }

    // Deduct from wallet
    wallet.balance = currentBalance - withdrawAmount;
    wallet.transactions.push({
      type: "Withdrawal",
      amount: withdrawAmount,
      description: `Withdrawal to bank account`,
      timestamp: new Date(),
      balanceAfter: wallet.balance
    });

    await driver.save();

    console.log("Withdrawal successful");
    console.log("=== WITHDRAWAL SUCCESS ===");

    res.json({
      success: true,
      message: "Withdrawal request processed",
      wallet: {
        balance: wallet.balance,
        withdrawnAmount: withdrawAmount
      }
    });
  } catch (error) {
    console.error("=== WITHDRAWAL ERROR ===");
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Withdrawal failed",
      error: error.message
    });
  }
};

/**
 * POST /api/wallet/admin/payout-driver
 * Admin pays driver from admin wallet
 */
export const payoutToDriver = async (req, res) => {
  try {
    const { driverId, amount, deliveryId, description } = req.body;
    const adminId = req.user._id;

    console.log("=== ADMIN PAYOUT TO DRIVER ===");
    console.log("Admin ID:", adminId);
    console.log("Driver ID:", driverId);
    console.log("Amount:", amount);

    if (!driverId || !amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ message: "Driver ID and valid amount are required" });
    }

    const payoutAmount = parseFloat(amount);

    // Find admin
    const admin = await User.findById(adminId);
    if (!admin || admin.role !== "Admin") {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // Find driver
    const driver = await User.findById(driverId);
    if (!driver || driver.role !== "Driver") {
      return res.status(404).json({ message: "Driver not found" });
    }

    // Initialize admin wallet if needed
    if (!admin.adminWallet) {
      admin.adminWallet = { balance: 0, totalRevenue: 0, transactions: [] };
    }

    const adminBalance = admin.adminWallet.balance || 0;

    // Check admin wallet balance
    if (adminBalance < payoutAmount) {
      return res.status(400).json({
        success: false,
        message: "Insufficient admin wallet balance",
        available: adminBalance,
        required: payoutAmount
      });
    }

    // Deduct from admin wallet
    admin.adminWallet.balance = adminBalance - payoutAmount;
    admin.adminWallet.transactions.push({
      type: "DriverPayout",
      amount: payoutAmount,
      description: description || `Payout to driver ${driver.name}`,
      deliveryId: deliveryId || "",
      driverId: driverId,
      timestamp: new Date(),
      balanceAfter: admin.adminWallet.balance
    });

    await admin.save();

    // Add to driver wallet
    if (!driver.driverProfile.wallet) {
      driver.driverProfile.wallet = { balance: 0, totalEarnings: 0, transactions: [] };
    }

    const driverBalance = driver.driverProfile.wallet.balance || 0;
    driver.driverProfile.wallet.balance = driverBalance + payoutAmount;
    driver.driverProfile.wallet.totalEarnings = (driver.driverProfile.wallet.totalEarnings || 0) + payoutAmount;
    driver.driverProfile.wallet.transactions.push({
      type: "Credit",
      amount: payoutAmount,
      description: description || `Earnings from delivery`,
      deliveryId: deliveryId || "",
      timestamp: new Date(),
      balanceAfter: driver.driverProfile.wallet.balance
    });

    await driver.save();

    console.log("Payout successful");
    console.log("=== PAYOUT SUCCESS ===");

    res.json({
      success: true,
      message: "Payout completed successfully",
      adminWallet: {
        balance: admin.adminWallet.balance
      },
      driverWallet: {
        balance: driver.driverProfile.wallet.balance
      }
    });
  } catch (error) {
    console.error("=== PAYOUT ERROR ===");
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Payout failed",
      error: error.message
    });
  }
};

/**
 * GET /api/wallet/admin/balance
 * Get admin wallet balance
 */
export const getAdminWalletBalance = async (req, res) => {
  try {
    const adminId = req.user._id;

    const admin = await User.findById(adminId);
    if (!admin || admin.role !== "Admin") {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const wallet = admin.adminWallet || { balance: 0, totalRevenue: 0, transactions: [] };

    res.json({
      success: true,
      balance: wallet.balance || 0,
      totalRevenue: wallet.totalRevenue || 0,
      transactions: (wallet.transactions || []).slice(-20).reverse()
    });
  } catch (error) {
    console.error("Error fetching admin wallet:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch wallet balance",
      error: error.message
    });
  }
};
