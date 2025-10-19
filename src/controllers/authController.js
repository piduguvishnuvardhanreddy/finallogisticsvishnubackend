// src/controllers/authController.js
import User from "../models/User.js";
import generateToken from "../utils/generateToken.js";


//Register
export const registerUser = async (req, res) => {
  const { name, email, password, role } = req.body;

  try {
    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ message: "User already exists" });

    // role can only be one of: Admin, Driver, Customer
    const allowedRoles = ["Admin", "Driver", "Customer"];
    const validRole = allowedRoles.includes(role) ? role : "Customer";

    const user = await User.create({ name, email, password, role: validRole });

    res.status(201).json({
      _id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Login
export const loginUser = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (user && (await user.matchPassword(password))) {
      res.json({
        _id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ message: "Invalid email or password" });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Profile
export const getProfile = async (req, res) => {
  res.json(req.user);
};

// Get all drivers
export const getDrivers = async (req, res) => {
  try {
    const drivers = await User.find({ role: "Driver" }).select("-password");
    res.json(drivers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all users (Admin only)
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({}).select("-password");
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
