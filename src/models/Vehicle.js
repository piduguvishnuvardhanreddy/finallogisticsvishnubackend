import mongoose from "mongoose";

const vehicleSchema = new mongoose.Schema(
  {
    vehicleId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    type: { 
      type: String, 
      required: true,
      enum: ["Truck", "Van", "Pickup", "Motorcycle", "Car"]
    },
    plateNumber: { type: String, required: true, unique: true },
    model: { type: String, required: true },
    year: { type: Number },
    capacity: { 
      weight: { type: Number, default: 0 }, // in kg
      volume: { type: Number, default: 0 }  // in cubic meters
    },
    currentLocation: {
      lat: { type: Number, default: 0 },
      lng: { type: Number, default: 0 },
      address: { type: String },
      lastUpdated: { type: Date, default: Date.now }
    },
    status: {
      type: String,
      enum: ["Available", "On Route", "Maintenance", "Out of Service"],
      default: "Available",
    },
    assignedDriver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    documents: [{
      type: { type: String, enum: ["Insurance", "Registration", "License", "Inspection", "Other"] },
      fileName: String,
      fileUrl: String,
      expiryDate: Date,
      uploadedAt: { type: Date, default: Date.now }
    }],
    fuelType: { 
      type: String, 
      enum: ["Petrol", "Diesel", "Electric", "Hybrid"],
      default: "Diesel"
    },
    fuelEfficiency: { type: Number }, // km per liter
    lastMaintenanceDate: { type: Date },
    nextMaintenanceDate: { type: Date },
    maintenanceHistory: [{
      date: Date,
      type: String,
      description: String,
      cost: Number,
      mileage: Number
    }],
    totalMileage: { type: Number, default: 0 },
    insuranceExpiry: { type: Date },
    registrationExpiry: { type: Date },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

// Index for geospatial queries
vehicleSchema.index({ "currentLocation.lat": 1, "currentLocation.lng": 1 });

// Virtual for days until maintenance
vehicleSchema.virtual("daysUntilMaintenance").get(function() {
  if (!this.nextMaintenanceDate) return null;
  const days = Math.ceil((this.nextMaintenanceDate - new Date()) / (1000 * 60 * 60 * 24));
  return days;
});

export default mongoose.model("Vehicle", vehicleSchema);

