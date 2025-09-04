import mongoose from "mongoose";
import Admin from "./models/admin.model.js";
import dotenv from "dotenv";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

async function seedAdmin() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB");

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({email: "admin@admin.com"});
    if (existingAdmin) {
      console.log("Admin already exists");
      process.exit(0);
    }

    // Create default admin
    const admin = new Admin({
      username: "admin",
      email: "admin@admin.com",
      password: "admin123", // Change this in production
    });

    await admin.save();
    console.log("Admin created successfully");
    console.log("Email: admin@admin.com");
    console.log("Password: admin123");

    process.exit(0);
  } catch (error) {
    console.error("Error seeding admin:", error);
    process.exit(1);
  }
}

seedAdmin();
