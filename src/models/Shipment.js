import mongoose from "mongoose";

const shipmentSchema = new mongoose.Schema(
  {
    shipmentId: { type: String, required: true, unique: true },
    trackingNumber: { type: String, required: true, unique: true },
    sender: {
      name: { type: String, required: true },
      contact: String,
      email: String,
      address: { type: String, required: true },
      lat: Number,
      lng: Number
    },
    receiver: {
      name: { type: String, required: true },
      contact: { type: String, required: true },
      email: String,
      address: { type: String, required: true },
      lat: Number,
      lng: Number
    },
    package: {
      description: { type: String, required: true },
      weight: { type: Number, required: true }, // in kg
      dimensions: {
        length: Number,
        width: Number,
        height: Number,
        unit: { type: String, default: "cm" }
      },
      quantity: { type: Number, default: 1 },
      value: Number, // monetary value
      fragile: { type: Boolean, default: false },
      perishable: { type: Boolean, default: false }
    },
    status: {
      type: String,
      enum: [
        "Created",
        "Picked Up",
        "In Transit",
        "Out for Delivery",
        "Delivered",
        "Failed Delivery",
        "Returned",
        "Cancelled"
      ],
      default: "Created"
    },
    assignedTrip: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Trip",
      default: null
    },
    priority: {
      type: String,
      enum: ["Low", "Normal", "High", "Urgent"],
      default: "Normal"
    },
    serviceType: {
      type: String,
      enum: ["Standard", "Express", "Same Day", "Next Day"],
      default: "Standard"
    },
    estimatedDeliveryDate: Date,
    actualDeliveryDate: Date,
    pickupDate: Date,
    statusHistory: [{
      status: String,
      timestamp: { type: Date, default: Date.now },
      location: {
        address: String,
        lat: Number,
        lng: Number
      },
      notes: String,
      updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      }
    }],
    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid", "COD", "Refunded"],
      default: "Pending"
    },
    shippingCost: Number,
    insurance: {
      covered: { type: Boolean, default: false },
      amount: Number
    },
    specialInstructions: String,
    proofOfDelivery: {
      signature: String, // base64 or URL
      photo: String, // URL
      receivedBy: String,
      timestamp: Date
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  },
  { timestamps: true }
);

// Indexes for efficient queries
shipmentSchema.index({ trackingNumber: 1 });
shipmentSchema.index({ status: 1 });
shipmentSchema.index({ customer: 1 });
shipmentSchema.index({ assignedTrip: 1 });
shipmentSchema.index({ estimatedDeliveryDate: 1 });

// Virtual for delivery status
shipmentSchema.virtual("isDelivered").get(function() {
  return this.status === "Delivered";
});

// Virtual for overdue status
shipmentSchema.virtual("isOverdue").get(function() {
  if (!this.estimatedDeliveryDate || this.status === "Delivered") return false;
  return new Date() > this.estimatedDeliveryDate;
});

// Method to add status update
shipmentSchema.methods.addStatusUpdate = function(status, location, notes, userId) {
  this.status = status;
  this.statusHistory.push({
    status,
    location,
    notes,
    updatedBy: userId,
    timestamp: new Date()
  });
  return this.save();
};

export default mongoose.model("Shipment", shipmentSchema);
