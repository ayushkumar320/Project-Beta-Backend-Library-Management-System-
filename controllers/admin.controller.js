import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import Admin from "../models/admin.model";
import User from "../models/user.model.js";
import SubscriptionPlan from "../models/subscriptionPlan.model.js";
import dotenv from "dotenv";
dotenv.config();

const secret = process.env.JWT_SECRET;

export async function adminLogin(req, res) {
  const {email, password} = req.body;

  try {
    const admin = await Admin.findOne({email});
    if (!admin) {
      return res.status(404).json({message: "Admin not found"});
    }
    if (admin.password !== password) {
      return res.status(401).json({message: "Invalid credentials"});
    }
    const token = jwt.sign({_id: admin._id}, secret);
    res.json({token});
  } catch (error) {
    console.error("Error logging in admin:", error);
    res.status(500).json({message: "Internal server error"});
  }
}

export async function registerUser(req, res) {
  const {name, adharNumber, subscriptionPlan, joiningDate, feePaid, seatNumber, age, address, idNumber, isActive} = req.body;
  try {
    const existingUser = await User.findOne({adharNumber});
    if (existingUser) {
      return res.status(400).json({message: "User already exists"});
    }
    const user = new User({
      name,
      adharNumber,
      subscriptionPlan,
      joiningDate,
      feePaid,
      seatNumber,
      age,
      address,
      idNumber,
      isActive
    });
    await user.save();
    res.status(201).json({message: "User registered successfully"});
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({message: "Internal server error"});
  }
};

export async function createSubscriptionPlan(req, res) {
  const {planName, price, duration, subscribers, status} = req.body;
  try {
    const existingPlan = await SubscriptionPlan.findOne({
      planName
    });
    if(existingPlan) {
      return res.status(400).json({
        message: "Plan already exists"
      });
    }
    const newPlan = new SubscriptionPlan({
      planName,
      price,
      duration,
      subscribers,
      status
    });
    await newPlan.save();
    return res.json({
      message: "New subscription plan added!",
      planName: planName
    });

  } catch (error) {
    console.log("Error creating the subscription plan");
    res.status(500).json({
      message: "Internal server error"
    });
  }
};

export async function updateStudent(req, res) {
  const {name, adharNumber, subscriptionPlan, joiningDate, feePaid, seatNumber, age, address, idNumber, isActive} = req.body;

  try {
    const existingUser = await User.findOne({adharNumber});
    if (!existingUser) {
      return res.status(404).json({message: "User not found"});
    }

    existingUser.name = name;
    existingUser.subscriptionPlan = subscriptionPlan;
    existingUser.joiningDate = joiningDate;
    existingUser.feePaid = feePaid;
    existingUser.seatNumber = seatNumber;
    existingUser.age = age;
    existingUser.address = address;
    existingUser.idNumber = idNumber;
    existingUser.isActive = isActive;

    await existingUser.save();
    res.json({
      name: existingUser.name,
      message: "User updated successfully"
    });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({message: "Internal server error"});
  }
}

export async function updateSubscriptionPlan(req, res) {
  const {planName, price, duration, subscribers, status} = req.body;

  try {
    const existingPlan = await SubscriptionPlan.findOne({planName});
    if (!existingPlan) {
      return res.status(404).json({message: "Subscription plan not found"});
    }

    existingPlan.price = price;
    existingPlan.duration = duration;
    existingPlan.subscribers = subscribers;
    existingPlan.status = status;

    await existingPlan.save();
    res.json({
      message: "Subscription plan updated successfully",
      planName: existingPlan.planName
    });
  } catch (error) {
    console.error("Error updating subscription plan:", error);
    res.status(500).json({message: "Internal server error"});
  }
}