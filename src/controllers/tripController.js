import Trip from "../models/Trip.js";
import Vehicle from "../models/Vehicle.js";
import User from "../models/User.js";
import Shipment from "../models/Shipment.js";

// Generate unique trip ID
const generateTripId = () => {
  return `TRIP-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
};

// Create new trip
export const createTrip = async (req, res) => {
  try {
    const {
      vehicle,
      driver,
      startLocation,
      destination,
      waypoints,
      cargo,
      scheduledStartTime,
      estimatedArrivalTime,
      route,
      shipments
    } = req.body;

    // Validate vehicle and driver
    const vehicleDoc = await Vehicle.findById(vehicle);
    const driverDoc = await User.findById(driver);

    if (!vehicleDoc) {
      return res.status(404).json({ message: "Vehicle not found" });
    }
    if (!driverDoc || driverDoc.role !== "Driver") {
      return res.status(404).json({ message: "Driver not found" });
    }

    const trip = await Trip.create({
      tripId: generateTripId(),
      vehicle,
      driver,
      startLocation,
      destination,
      waypoints: waypoints || [],
      cargo,
      scheduledStartTime,
      estimatedArrivalTime,
      route,
      shipments: shipments || []
    });

    // Update vehicle status
    await Vehicle.findByIdAndUpdate(vehicle, { status: "On Route" });

    // Update shipments if provided
    if (shipments && shipments.length > 0) {
      await Shipment.updateMany(
        { _id: { $in: shipments } },
        { assignedTrip: trip._id, status: "In Transit" }
      );
    }

    const populatedTrip = await Trip.findById(trip._id)
      .populate("vehicle", "name plateNumber type")
      .populate("driver", "name email phone")
      .populate("shipments", "trackingNumber sender receiver");

    res.status(201).json(populatedTrip);
  } catch (error) {
    console.error("Error creating trip:", error);
    res.status(500).json({ message: error.message });
  }
};

// Get all trips
export const getAllTrips = async (req, res) => {
  try {
    const { status, driver, vehicle, startDate, endDate } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (driver) filter.driver = driver;
    if (vehicle) filter.vehicle = vehicle;
    if (startDate || endDate) {
      filter.scheduledStartTime = {};
      if (startDate) filter.scheduledStartTime.$gte = new Date(startDate);
      if (endDate) filter.scheduledStartTime.$lte = new Date(endDate);
    }

    const trips = await Trip.find(filter)
      .populate("vehicle", "name plateNumber type status")
      .populate("driver", "name email phone")
      .populate("shipments", "trackingNumber status")
      .sort({ scheduledStartTime: -1 });

    res.json(trips);
  } catch (error) {
    console.error("Error fetching trips:", error);
    res.status(500).json({ message: error.message });
  }
};

// Get trip by ID
export const getTripById = async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id)
      .populate("vehicle")
      .populate("driver", "-password")
      .populate("shipments");

    if (!trip) {
      return res.status(404).json({ message: "Trip not found" });
    }

    res.json(trip);
  } catch (error) {
    console.error("Error fetching trip:", error);
    res.status(500).json({ message: error.message });
  }
};

// Update trip
export const updateTrip = async (req, res) => {
  try {
    const trip = await Trip.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    )
      .populate("vehicle", "name plateNumber type")
      .populate("driver", "name email phone")
      .populate("shipments", "trackingNumber status");

    if (!trip) {
      return res.status(404).json({ message: "Trip not found" });
    }

    res.json(trip);
  } catch (error) {
    console.error("Error updating trip:", error);
    res.status(500).json({ message: error.message });
  }
};

// Start trip
export const startTrip = async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);

    if (!trip) {
      return res.status(404).json({ message: "Trip not found" });
    }

    trip.status = "Started";
    trip.actualStartTime = new Date();
    await trip.save();

    // Update shipments status
    if (trip.shipments && trip.shipments.length > 0) {
      await Shipment.updateMany(
        { _id: { $in: trip.shipments } },
        { status: "In Transit" }
      );
    }

    const updatedTrip = await Trip.findById(trip._id)
      .populate("vehicle", "name plateNumber type")
      .populate("driver", "name email phone")
      .populate("shipments", "trackingNumber status");

    res.json(updatedTrip);
  } catch (error) {
    console.error("Error starting trip:", error);
    res.status(500).json({ message: error.message });
  }
};

// Complete trip
export const completeTrip = async (req, res) => {
  try {
    const { completionNotes, rating } = req.body;
    const trip = await Trip.findById(req.params.id);

    if (!trip) {
      return res.status(404).json({ message: "Trip not found" });
    }

    trip.status = "Completed";
    trip.actualArrivalTime = new Date();
    trip.completionNotes = completionNotes;
    trip.rating = rating;
    await trip.save();

    // Update vehicle status
    await Vehicle.findByIdAndUpdate(trip.vehicle, { status: "Available" });

    // Update driver performance
    const driver = await User.findById(trip.driver);
    if (driver && driver.driverProfile) {
      driver.driverProfile.performance.completedTrips += 1;
      driver.driverProfile.performance.totalTrips += 1;
      driver.driverProfile.performance.totalDistance += trip.route?.distance || 0;
      
      // Calculate average rating
      const allTrips = await Trip.find({ driver: trip.driver, rating: { $exists: true } });
      const avgRating = allTrips.reduce((sum, t) => sum + (t.rating || 0), 0) / allTrips.length;
      driver.driverProfile.performance.averageRating = avgRating;
      
      await driver.save();
    }

    const updatedTrip = await Trip.findById(trip._id)
      .populate("vehicle", "name plateNumber type")
      .populate("driver", "name email phone")
      .populate("shipments", "trackingNumber status");

    res.json(updatedTrip);
  } catch (error) {
    console.error("Error completing trip:", error);
    res.status(500).json({ message: error.message });
  }
};

// Update trip location (for real-time tracking)
export const updateTripLocation = async (req, res) => {
  try {
    const { lat, lng, speed } = req.body;
    
    const trip = await Trip.findByIdAndUpdate(
      req.params.id,
      {
        currentProgress: {
          lat,
          lng,
          speed,
          lastUpdated: new Date()
        }
      },
      { new: true }
    );

    if (!trip) {
      return res.status(404).json({ message: "Trip not found" });
    }

    // Also update vehicle location
    await Vehicle.findByIdAndUpdate(trip.vehicle, {
      "currentLocation.lat": lat,
      "currentLocation.lng": lng,
      "currentLocation.lastUpdated": new Date()
    });

    res.json(trip);
  } catch (error) {
    console.error("Error updating trip location:", error);
    res.status(500).json({ message: error.message });
  }
};

// Add delay to trip
export const addDelay = async (req, res) => {
  try {
    const { reason, duration } = req.body;
    
    const trip = await Trip.findById(req.params.id);
    if (!trip) {
      return res.status(404).json({ message: "Trip not found" });
    }

    trip.delays.push({
      reason,
      duration,
      reportedAt: new Date()
    });
    trip.status = "Delayed";
    await trip.save();

    res.json(trip);
  } catch (error) {
    console.error("Error adding delay:", error);
    res.status(500).json({ message: error.message });
  }
};

// Get driver trips
export const getDriverTrips = async (req, res) => {
  try {
    const trips = await Trip.find({ driver: req.params.driverId })
      .populate("vehicle", "name plateNumber type")
      .populate("shipments", "trackingNumber status")
      .sort({ scheduledStartTime: -1 });

    res.json(trips);
  } catch (error) {
    console.error("Error fetching driver trips:", error);
    res.status(500).json({ message: error.message });
  }
};

// Delete trip
export const deleteTrip = async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);
    
    if (!trip) {
      return res.status(404).json({ message: "Trip not found" });
    }

    // Update vehicle status
    await Vehicle.findByIdAndUpdate(trip.vehicle, { status: "Available" });

    // Unassign shipments
    if (trip.shipments && trip.shipments.length > 0) {
      await Shipment.updateMany(
        { _id: { $in: trip.shipments } },
        { assignedTrip: null, status: "Created" }
      );
    }

    await Trip.findByIdAndDelete(req.params.id);

    res.json({ message: "Trip deleted successfully" });
  } catch (error) {
    console.error("Error deleting trip:", error);
    res.status(500).json({ message: error.message });
  }
};
