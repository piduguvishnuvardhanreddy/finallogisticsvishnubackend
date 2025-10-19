import mongoose from "mongoose";

const deliverySchema = new mongoose.Schema(
  {
    deliveryId: { type: String, unique: true },
    pickupLocation: {
      address: String,
      lat: Number,
      lng: Number,
    },
    dropLocation: {
      address: String,
      lat: Number,
      lng: Number,
    },
    assignedDriver: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    assignedVehicle: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle" },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Assigned", "Accepted", "On Route", "Delivered", "Cancelled", "Rejected"],
      default: "Pending",
    },
    adminApproved: { type: Boolean, default: false },
    driverAccepted: { type: Boolean, default: false },
    driverRejectedReason: String,
    startTime: Date,
    endTime: Date,
    // Customer booking fields
    packageDetails: {
      weight: Number,
      dimensions: String,
      description: String,
      packageType: String,
      cluster: { type: String, enum: ["Small", "Medium", "Large", "Extra Large"], default: "Small" },
    },
    preferredDate: Date,
    preferredTime: String,
    contactNumber: String,
    specialInstructions: String,
    estimatedDistance: Number,
    estimatedDuration: Number,
    
    // Pricing based on weight and cluster
    pricing: {
      basePrice: { type: Number, default: 0 },
      weightCharge: { type: Number, default: 0 },
      distanceCharge: { type: Number, default: 0 },
      clusterCharge: { type: Number, default: 0 },
      totalPrice: { type: Number, default: 0 },
      currency: { type: String, default: "INR" },
    },
    
    // Payment and wallet
    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid", "Failed", "Refunded"],
      default: "Pending",
    },
    paymentMethod: {
      type: String,
      enum: ["Cash", "Card", "Wallet", "UPI"],
    },
    paidAt: Date,
    
    // Driver earnings
    driverEarnings: {
      amount: { type: Number, default: 0 },
      commission: { type: Number, default: 0.7 }, // 70% to driver
      netEarnings: { type: Number, default: 0 },
      paidToDriver: { type: Boolean, default: false },
      paidAt: Date,
    },
    
    // Rating and feedback
    rating: {
      stars: { type: Number, min: 1, max: 5 },
      feedback: String,
      ratedAt: Date,
    },
    
    // Real-time tracking
    currentLocation: {
      lat: Number,
      lng: Number,
      lastUpdated: Date,
    },
    
    // Status history for tracking
    statusHistory: [{
      status: String,
      timestamp: { type: Date, default: Date.now },
      updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      notes: String,
    }],
    
    // Cancellation details
    cancellation: {
      cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      cancelledAt: Date,
      reason: String,
      refundAmount: Number,
      refundStatus: { type: String, enum: ["Pending", "Processed", "Failed"] },
    },
  },
  { timestamps: true }
);

// Generate unique delivery ID
deliverySchema.pre('save', function(next) {
  if (!this.deliveryId) {
    this.deliveryId = `DEL-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  }
  next();
});

// Calculate pricing
deliverySchema.methods.calculatePricing = function() {
  const weight = this.packageDetails.weight || 0;
  const distance = this.estimatedDistance || 0;
  const cluster = this.packageDetails.cluster || "Small";
  
  // Base price
  this.pricing.basePrice = 50;
  
  // Weight charge (₹10 per kg)
  this.pricing.weightCharge = weight * 10;
  
  // Distance charge (₹8 per km)
  this.pricing.distanceCharge = distance * 8;
  
  // Cluster charge
  const clusterPrices = {
    "Small": 0,
    "Medium": 50,
    "Large": 100,
    "Extra Large": 200
  };
  this.pricing.clusterCharge = clusterPrices[cluster] || 0;
  
  // Total price
  this.pricing.totalPrice = 
    this.pricing.basePrice + 
    this.pricing.weightCharge + 
    this.pricing.distanceCharge + 
    this.pricing.clusterCharge;
  
  // Calculate driver earnings
  this.driverEarnings.amount = this.pricing.totalPrice;
  this.driverEarnings.netEarnings = this.pricing.totalPrice * this.driverEarnings.commission;
  
  return this.pricing.totalPrice;
};

// Add status update
deliverySchema.methods.addStatusUpdate = function(status, userId, notes) {
  this.status = status;
  this.statusHistory.push({
    status,
    updatedBy: userId,
    notes,
    timestamp: new Date()
  });
};

export default mongoose.model("Delivery", deliverySchema);
