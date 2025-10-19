import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["Admin", "Driver", "Customer", "Fleet Manager"],
      default: "Customer"
    },
    phone: String,
    address: String,
    // Driver-specific fields
    driverProfile: {
      licenseNumber: String,
      licenseExpiry: Date,
      licenseType: { type: String, enum: ["Class A", "Class B", "Class C", "Commercial"] },
      vehicleType: { type: String, enum: ["Bike", "Car", "Van", "Truck"] },
      assignedVehicles: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Vehicle"
      }],
      shiftSchedule: {
        monday: { start: String, end: String, active: Boolean },
        tuesday: { start: String, end: String, active: Boolean },
        wednesday: { start: String, end: String, active: Boolean },
        thursday: { start: String, end: String, active: Boolean },
        friday: { start: String, end: String, active: Boolean },
        saturday: { start: String, end: String, active: Boolean },
        sunday: { start: String, end: String, active: Boolean }
      },
      performance: {
        totalTrips: { type: Number, default: 0 },
        completedTrips: { type: Number, default: 0 },
        cancelledTrips: { type: Number, default: 0 },
        totalDistance: { type: Number, default: 0 }, // in km
        averageRating: { type: Number, default: 0 },
        onTimeDeliveryRate: { type: Number, default: 0 }, // percentage
        fuelEfficiency: { type: Number, default: 0 } // km per liter
      },
      status: {
        type: String,
        enum: ["Active", "On Leave", "Suspended", "Inactive"],
        default: "Active"
      },
      emergencyContact: {
        name: String,
        phone: String,
        relationship: String
      },
      documents: [{
        type: { type: String, enum: ["License", "Medical Certificate", "Background Check", "Other"] },
        fileName: String,
        fileUrl: String,
        expiryDate: Date,
        uploadedAt: { type: Date, default: Date.now }
      }],
      // Wallet for drivers
      wallet: {
        balance: { type: Number, default: 0 },
        totalEarnings: { type: Number, default: 0 },
        pendingEarnings: { type: Number, default: 0 },
        transactions: [{
          type: { type: String, enum: ["Credit", "Debit", "Withdrawal"] },
          amount: Number,
          description: String,
          deliveryId: String,
          timestamp: { type: Date, default: Date.now },
          balanceAfter: Number
        }]
      },
      // Ratings received
      ratings: [{
        deliveryId: { type: mongoose.Schema.Types.ObjectId, ref: "Delivery" },
        stars: { type: Number, min: 1, max: 5 },
        feedback: String,
        customerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        createdAt: { type: Date, default: Date.now }
      }]
    },
    // Customer wallet
    customerWallet: {
      balance: { type: Number, default: 0 },
      transactions: [{
        type: { type: String, enum: ["Credit", "Debit", "Refund"] },
        amount: Number,
        description: String,
        deliveryId: String,
        timestamp: { type: Date, default: Date.now },
        balanceAfter: Number
      }]
    },
    // Admin wallet
    adminWallet: {
      balance: { type: Number, default: 0 },
      totalRevenue: { type: Number, default: 0 },
      transactions: [{
        type: { type: String, enum: ["Credit", "Debit", "DriverPayout"] },
        amount: Number,
        description: String,
        deliveryId: String,
        driverId: String,
        timestamp: { type: Date, default: Date.now },
        balanceAfter: Number
      }]
    },
    isActive: { type: Boolean, default: true },
    lastLogin: Date
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model("User", userSchema);
export default User;

