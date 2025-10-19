import mongoose from "mongoose";

const tripSchema = new mongoose.Schema(
  {
    tripId: { type: String, required: true, unique: true },
    vehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vehicle",
      required: true
    },
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    startLocation: {
      address: { type: String, required: true },
      lat: { type: Number, required: true },
      lng: { type: Number, required: true }
    },
    destination: {
      address: { type: String, required: true },
      lat: { type: Number, required: true },
      lng: { type: Number, required: true }
    },
    waypoints: [{
      address: String,
      lat: Number,
      lng: Number,
      sequence: Number,
      status: { type: String, enum: ["Pending", "Reached", "Skipped"], default: "Pending" },
      reachedAt: Date
    }],
    cargo: {
      description: String,
      weight: Number, // in kg
      volume: Number, // in cubic meters
      quantity: Number,
      value: Number // monetary value
    },
    status: {
      type: String,
      enum: ["Scheduled", "Started", "In Transit", "Completed", "Cancelled", "Delayed"],
      default: "Scheduled"
    },
    scheduledStartTime: { type: Date, required: true },
    actualStartTime: { type: Date },
    estimatedArrivalTime: { type: Date },
    actualArrivalTime: { type: Date },
    route: {
      distance: Number, // in km
      duration: Number, // in minutes
      polyline: String, // encoded polyline for map display
      optimized: { type: Boolean, default: false }
    },
    fuelEstimate: {
      liters: Number,
      cost: Number
    },
    currentProgress: {
      lat: Number,
      lng: Number,
      speed: Number, // km/h
      lastUpdated: Date
    },
    delays: [{
      reason: String,
      duration: Number, // in minutes
      reportedAt: Date
    }],
    notes: String,
    completionNotes: String,
    rating: { type: Number, min: 1, max: 5 },
    shipments: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shipment"
    }]
  },
  { timestamps: true }
);

// Index for efficient queries
tripSchema.index({ driver: 1, status: 1 });
tripSchema.index({ vehicle: 1, status: 1 });
tripSchema.index({ scheduledStartTime: 1 });

// Virtual for trip duration
tripSchema.virtual("actualDuration").get(function() {
  if (!this.actualStartTime || !this.actualArrivalTime) return null;
  return Math.ceil((this.actualArrivalTime - this.actualStartTime) / (1000 * 60)); // in minutes
});

// Virtual for delay status
tripSchema.virtual("isDelayed").get(function() {
  if (!this.estimatedArrivalTime || this.status === "Completed") return false;
  return new Date() > this.estimatedArrivalTime;
});

export default mongoose.model("Trip", tripSchema);
