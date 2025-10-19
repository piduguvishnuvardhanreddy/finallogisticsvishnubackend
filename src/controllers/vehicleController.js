import Vehicle from "../models/Vehicle.js";

/**
 * POST /api/vehicles
 * Add a new vehicle (Admin only)
 */
export const addVehicle = async (req, res) => {
  try {
    console.log("=== ADD VEHICLE REQUEST RECEIVED ===");
    console.log("Request Body:", req.body);
    console.log("User:", req.user ? req.user.email : "No user");
    console.log("User Role:", req.user ? req.user.role : "No role");

    const { name, type, plateNumber, model, year, capacity, fuelType, status } = req.body;

    // Detailed validation
    if (!name) {
      console.log("❌ Validation failed: Name is missing");
      return res.status(400).json({ 
        success: false,
        message: "Vehicle name is required" 
      });
    }

    if (!type) {
      console.log("❌ Validation failed: Type is missing");
      return res.status(400).json({ 
        success: false,
        message: "Vehicle type is required" 
      });
    }

    if (!plateNumber) {
      console.log("❌ Validation failed: Plate number is missing");
      return res.status(400).json({ 
        success: false,
        message: "Plate number is required" 
      });
    }

    console.log("✅ Validation passed");

    // Check for duplicate plate number
    const plateUpper = plateNumber.toUpperCase().trim();
    console.log("Checking for duplicate plate number:", plateUpper);
    
    const existingVehicle = await Vehicle.findOne({ plateNumber: plateUpper });
    if (existingVehicle) {
      console.log("❌ Duplicate plate number found:", existingVehicle._id);
      return res.status(400).json({ 
        success: false,
        message: `Vehicle with plate number ${plateUpper} already exists` 
      });
    }

    console.log("✅ No duplicate found, creating vehicle...");

    // Auto-generate vehicleId
    const vehicleCount = await Vehicle.countDocuments();
    const vehicleId = `VEH-${String(vehicleCount + 1).padStart(4, '0')}`;
    console.log("Generated vehicleId:", vehicleId);

    // Create new vehicle with all required fields
    const vehicleData = {
      vehicleId: vehicleId,
      name: name.trim(),
      type: type.trim(),
      plateNumber: plateUpper,
      model: model ? model.trim() : name.trim(), // Use name as model if not provided
      year: year ? parseInt(year) : new Date().getFullYear(),
      capacity: {
        weight: capacity ? parseFloat(capacity) : 0,
        volume: 0
      },
      fuelType: fuelType || "Diesel",
      status: status || "Available",
      isActive: true
    };

    console.log("Vehicle data to save:", vehicleData);

    const newVehicle = new Vehicle(vehicleData);
    await newVehicle.save();

    console.log("✅ Vehicle created successfully!");
    console.log("Vehicle ID:", newVehicle._id);
    console.log("Vehicle vehicleId:", newVehicle.vehicleId);
    console.log("=== ADD VEHICLE SUCCESS ===");

    return res.status(201).json({
      success: true,
      message: "Vehicle added successfully",
      vehicle: newVehicle
    });

  } catch (error) {
    console.error("=== ADD VEHICLE ERROR ===");
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    
    return res.status(500).json({ 
      success: false,
      message: "Failed to add vehicle",
      error: error.message 
    });
  }
};

/**
 * GET /api/vehicles
 * Get all vehicles
 */
export const getVehicles = async (req, res) => {
  try {
    const vehicles = await Vehicle.find().sort({ createdAt: -1 });
    
    console.log(`Found ${vehicles.length} vehicles`);
    
    res.json(vehicles);
  } catch (error) {
    console.error("Error fetching vehicles:", error);
    res.status(500).json({ 
      message: "Failed to fetch vehicles",
      error: error.message 
    });
  }
};

/**
 * PUT /api/vehicles/:id/location
 * Update vehicle location (Driver → Real-time tracking)
 */
export const updateVehicleLocation = async (req, res) => {
  try {
    const { id } = req.params;
    const { lat, lng } = req.body;

    if (!lat || !lng) {
      return res.status(400).json({ message: "Latitude and longitude are required" });
    }

    const vehicle = await Vehicle.findById(id);
    if (!vehicle) {
      return res.status(404).json({ message: "Vehicle not found" });
    }

    vehicle.currentLocation = { 
      lat: parseFloat(lat), 
      lng: parseFloat(lng),
      lastUpdated: new Date()
    };
    await vehicle.save();

    console.log(`Vehicle ${vehicle.name} location updated: ${lat}, ${lng}`);

    res.json({
      success: true,
      message: "Location updated successfully",
      vehicle
    });
  } catch (error) {
    console.error("Error updating vehicle location:", error);
    res.status(500).json({ 
      message: "Failed to update location",
      error: error.message 
    });
  }
};

/**
 * PUT /api/vehicles/:id/status
 * Update vehicle status
 */
export const updateVehicleStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ["Available", "On Route", "Assigned", "Maintenance", "Out of Service"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        message: "Invalid status",
        validStatuses 
      });
    }

    const vehicle = await Vehicle.findById(id);
    if (!vehicle) {
      return res.status(404).json({ message: "Vehicle not found" });
    }

    vehicle.status = status;
    await vehicle.save();

    console.log(`Vehicle ${vehicle.name} status updated to ${status}`);

    res.json({
      success: true,
      message: "Status updated successfully",
      vehicle
    });
  } catch (error) {
    console.error("Error updating vehicle status:", error);
    res.status(500).json({ 
      message: "Failed to update status",
      error: error.message 
    });
  }
};

/**
 * PUT /api/vehicles/:id
 * Update vehicle (Admin only)
 */
export const updateVehicle = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, plateNumber, capacity, fuelType, status } = req.body;

    console.log("=== UPDATE VEHICLE REQUEST ===");
    console.log("Vehicle ID:", id);
    console.log("Data:", { name, type, plateNumber, capacity, fuelType, status });

    // Find vehicle
    const vehicle = await Vehicle.findById(id);
    if (!vehicle) {
      return res.status(404).json({ message: "Vehicle not found" });
    }

    // Validation
    if (!name || !type || !plateNumber) {
      return res.status(400).json({ 
        message: "Name, type, and plate number are required" 
      });
    }

    // Check if plate number is being changed and if it already exists
    if (plateNumber && plateNumber.toUpperCase() !== vehicle.plateNumber) {
      const exists = await Vehicle.findOne({ 
        plateNumber: plateNumber.toUpperCase(), 
        _id: { $ne: id } 
      });
      if (exists) {
        return res.status(400).json({ 
          message: "Plate number already exists" 
        });
      }
    }

    // Update fields
    vehicle.name = name;
    vehicle.type = type;
    vehicle.plateNumber = plateNumber.toUpperCase();
    vehicle.capacity = parseFloat(capacity) || 0;
    if (fuelType) vehicle.fuelType = fuelType;
    if (status) vehicle.status = status;

    await vehicle.save();

    console.log("Vehicle updated:", vehicle._id);
    console.log("=== UPDATE VEHICLE SUCCESS ===");

    res.json({
      success: true,
      message: "Vehicle updated successfully",
      vehicle
    });
  } catch (error) {
    console.error("=== UPDATE VEHICLE ERROR ===");
    console.error(error);
    res.status(500).json({ 
      success: false,
      message: "Failed to update vehicle",
      error: error.message 
    });
  }
};

/**
 * DELETE /api/vehicles/:id
 * Delete vehicle (Admin only)
 */
export const deleteVehicle = async (req, res) => {
  try {
    const { id } = req.params;

    console.log("=== DELETE VEHICLE REQUEST ===");
    console.log("Vehicle ID:", id);

    const vehicle = await Vehicle.findById(id);
    if (!vehicle) {
      return res.status(404).json({ message: "Vehicle not found" });
    }

    // Check if vehicle is currently assigned
    if (vehicle.status === "On Route" || vehicle.status === "Assigned") {
      return res.status(400).json({ 
        message: "Cannot delete vehicle that is currently in use. Please wait until it's available." 
      });
    }

    await Vehicle.findByIdAndDelete(id);

    console.log("Vehicle deleted:", vehicle.name);
    console.log("=== DELETE VEHICLE SUCCESS ===");

    res.json({
      success: true,
      message: "Vehicle deleted successfully"
    });
  } catch (error) {
    console.error("=== DELETE VEHICLE ERROR ===");
    console.error(error);
    res.status(500).json({ 
      success: false,
      message: "Failed to delete vehicle",
      error: error.message 
    });
  }
};

