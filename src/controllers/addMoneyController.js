import User from "../models/User.js";

/**
 * BRAND NEW ADD MONEY CONTROLLER
 * Simple, clean, and works!
 */

export const addMoneyToWallet = async (req, res) => {
  try {
    const { amount } = req.body;
    const userId = req.user._id;

    console.log("========================================");
    console.log("🆕 NEW ADD MONEY REQUEST");
    console.log("User ID:", userId);
    console.log("Amount:", amount);
    console.log("========================================");

    // Validate amount
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      console.log("❌ Invalid amount");
      return res.status(400).json({
        success: false,
        message: "Please provide a valid amount"
      });
    }

    const amountToAdd = parseFloat(amount);

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      console.log("❌ User not found");
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    console.log("✅ User found:", user.name);

    // Initialize wallet if doesn't exist
    if (!user.customerWallet) {
      console.log("🔧 Initializing new wallet");
      user.customerWallet = {
        balance: 0,
        transactions: []
      };
    }

    // Get old balance
    const oldBalance = user.customerWallet.balance || 0;
    console.log("💰 Old balance:", oldBalance);

    // Add money
    user.customerWallet.balance = oldBalance + amountToAdd;
    console.log("💰 New balance:", user.customerWallet.balance);

    // Add transaction record
    user.customerWallet.transactions.push({
      type: "Credit",
      amount: amountToAdd,
      description: "Money added to wallet",
      timestamp: new Date(),
      balanceAfter: user.customerWallet.balance
    });

    // Save to database
    await user.save();

    console.log("✅ Money added successfully!");
    console.log("========================================");

    // Send response
    res.status(200).json({
      success: true,
      message: `₹${amountToAdd} added successfully!`,
      data: {
        oldBalance: oldBalance,
        amountAdded: amountToAdd,
        newBalance: user.customerWallet.balance
      }
    });

  } catch (error) {
    console.error("========================================");
    console.error("❌ ERROR IN ADD MONEY:");
    console.error(error);
    console.error("========================================");
    
    res.status(500).json({
      success: false,
      message: "Failed to add money",
      error: error.message
    });
  }
};

export const getWalletBalance = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const balance = user.customerWallet?.balance || 0;
    const transactions = user.customerWallet?.transactions || [];

    res.status(200).json({
      success: true,
      balance: balance,
      transactions: transactions
    });

  } catch (error) {
    console.error("Error getting balance:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get balance"
    });
  }
};
