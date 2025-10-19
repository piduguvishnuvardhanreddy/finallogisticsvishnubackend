import mongoose from "mongoose";

const feedbackSchema = new mongoose.Schema(
  {
    delivery: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Delivery",
      required: true
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    rating: {
      stars: { type: Number, required: true, min: 1, max: 5 },
      categories: {
        punctuality: { type: Number, min: 1, max: 5 },
        professionalism: { type: Number, min: 1, max: 5 },
        vehicleCondition: { type: Number, min: 1, max: 5 },
        communication: { type: Number, min: 1, max: 5 }
      }
    },
    feedback: {
      type: String,
      required: true
    },
    tags: [{
      type: String,
      enum: ["Excellent Service", "On Time", "Professional", "Friendly", "Careful Handling", "Needs Improvement", "Late", "Rude", "Damaged Package"]
    }],
    adminViewed: {
      type: Boolean,
      default: false
    },
    adminResponse: {
      message: String,
      respondedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      },
      respondedAt: Date
    }
  },
  { timestamps: true }
);

// Indexes
feedbackSchema.index({ driver: 1 });
feedbackSchema.index({ customer: 1 });
feedbackSchema.index({ delivery: 1 });
feedbackSchema.index({ "rating.stars": 1 });

export default mongoose.model("Feedback", feedbackSchema);
