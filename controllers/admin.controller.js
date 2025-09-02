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
  const {
    name,
    adharNumber,
    subscriptionPlan,
    joiningDate,
    feePaid,
    seatNumber,
    age,
    address,
    idNumber,
    isActive,
  } = req.body;
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
      isActive,
    });
    await user.save();
    res.status(201).json({message: "User registered successfully"});
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({message: "Internal server error"});
  }
}

export async function createSubscriptionPlan(req, res) {
  const {planName, price, duration, subscribers, status} = req.body;
  try {
    const existingPlan = await SubscriptionPlan.findOne({
      planName,
    });
    if (existingPlan) {
      return res.status(400).json({
        message: "Plan already exists",
      });
    }
    const newPlan = new SubscriptionPlan({
      planName,
      price,
      duration,
      subscribers,
      status,
    });
    await newPlan.save();
    return res.json({
      message: "New subscription plan added!",
      planName: planName,
    });
  } catch (error) {
    console.log("Error creating the subscription plan");
    res.status(500).json({
      message: "Internal server error",
    });
  }
}

export async function updateStudent(req, res) {
  const {
    name,
    adharNumber,
    subscriptionPlan,
    joiningDate,
    feePaid,
    seatNumber,
    age,
    address,
    idNumber,
    isActive,
  } = req.body;

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
      message: "User updated successfully",
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
      planName: existingPlan.planName,
    });
  } catch (error) {
    console.error("Error updating subscription plan:", error);
    res.status(500).json({message: "Internal server error"});
  }
}

// GET Controllers

export async function getSubscriptionPlans(req, res) {
  try {
    const plans = await SubscriptionPlan.find();
    res.json(plans);
  } catch (error) {
    console.error("Error fetching subscription plans:", error);
    res.status(500).json({message: "Internal server error"});
  }
}

export async function getUsers(req, res) {
  try {
    const users = await User.find();
    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({message: "Internal server error"});
  }
}

export async function getDashboardCount(req, res) {
  try {
    const userCount = await User.countDocuments();
    const planCount = await SubscriptionPlan.countDocuments();
    const activeUsers = await User.countDocuments({isActive: true});

    // Get dynamic subscription expiry counts
    const today = new Date();
    const users = await User.find({isActive: true})
      .populate("subscriptionPlan", "planName duration")
      .exec();

    let expiringIn5Days = 0;
    let expiredToday = 0;
    let expiringIn1Day = 0;
    let expiringIn2Days = 0;
    let expiringIn3Days = 0;
    let expiringIn4Days = 0;

    for (const user of users) {
      if (!user.subscriptionPlan) continue;

      // Calculate expiration date based on joining date and plan duration
      const joiningDate = new Date(user.joiningDate);
      const planDuration = user.subscriptionPlan.duration;
      const durationLower = planDuration.toLowerCase();

      let expirationDate = new Date(joiningDate);

      if (durationLower.includes("day")) {
        const days = parseInt(planDuration.match(/\d+/)[0]);
        expirationDate.setDate(joiningDate.getDate() + days);
      } else if (durationLower.includes("week")) {
        const weeks = parseInt(planDuration.match(/\d+/)[0]);
        expirationDate.setDate(joiningDate.getDate() + weeks * 7);
      } else if (durationLower.includes("month")) {
        const months = parseInt(planDuration.match(/\d+/)[0]);
        expirationDate.setMonth(joiningDate.getMonth() + months);
      } else if (durationLower.includes("year")) {
        const years = parseInt(planDuration.match(/\d+/)[0]);
        expirationDate.setFullYear(joiningDate.getFullYear() + years);
      }

      // Calculate days difference
      const timeDiff = expirationDate.getTime() - today.getTime();
      const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

      // Categorize based on days left
      if (daysDiff <= 0) {
        expiredToday++;
      } else if (daysDiff === 1) {
        expiringIn1Day++;
      } else if (daysDiff === 2) {
        expiringIn2Days++;
      } else if (daysDiff === 3) {
        expiringIn3Days++;
      } else if (daysDiff === 4) {
        expiringIn4Days++;
      } else if (daysDiff === 5) {
        expiringIn5Days++;
      }
    }

    const totalExpiringIn5Days =
      expiringIn1Day +
      expiringIn2Days +
      expiringIn3Days +
      expiringIn4Days +
      expiringIn5Days;

    res.json({
      userCount,
      planCount,
      activeUsers,
      subscriptionExpiry: {
        expiringIn5Days: totalExpiringIn5Days,
        expiredToday,
        breakdown: {
          expiringIn1Day,
          expiringIn2Days,
          expiringIn3Days,
          expiringIn4Days,
          expiringIn5Days,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    res.status(500).json({message: "Internal server error"});
  }
}

export async function getSubscriptionEndingPlan(req, res) {
  try {
    const today = new Date();
    const fiveDaysFromNow = new Date();
    fiveDaysFromNow.setDate(today.getDate() + 5);

    // Find users whose subscriptions are expiring in the next 5 days
    const users = await User.find({isActive: true})
      .populate("subscriptionPlan", "planName duration")
      .exec();

    const expiringUsers = [];

    for (const user of users) {
      if (!user.subscriptionPlan) continue;

      // Calculate expiration date based on joining date and plan duration
      const joiningDate = new Date(user.joiningDate);
      const planDuration = user.subscriptionPlan.duration;

      // Parse duration (handles formats like "1 week", "1 MONTH", "30 days", "6 MONTHS", etc.)
      let expirationDate = new Date(joiningDate);
      const durationLower = planDuration.toLowerCase();

      if (durationLower.includes("day")) {
        const days = parseInt(planDuration.match(/\d+/)[0]);
        expirationDate.setDate(joiningDate.getDate() + days);
      } else if (durationLower.includes("week")) {
        const weeks = parseInt(planDuration.match(/\d+/)[0]);
        expirationDate.setDate(joiningDate.getDate() + weeks * 7);
      } else if (durationLower.includes("month")) {
        const months = parseInt(planDuration.match(/\d+/)[0]);
        expirationDate.setMonth(joiningDate.getMonth() + months);
      } else if (durationLower.includes("year")) {
        const years = parseInt(planDuration.match(/\d+/)[0]);
        expirationDate.setFullYear(joiningDate.getFullYear() + years);
      }

      // Check if expiration is within the next 5 days
      const timeDiff = expirationDate.getTime() - today.getTime();
      const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

      if (daysDiff > 0 && daysDiff <= 5) {
        expiringUsers.push({
          name: user.name,
          seatNumber: user.seatNumber,
          expirationDate: expirationDate.toISOString().split("T")[0], // YYYY-MM-DD format
          daysLeft: daysDiff,
          planName: user.subscriptionPlan.planName,
        });
      }
    }

    // Sort by days left (ascending)
    expiringUsers.sort((a, b) => a.daysLeft - b.daysLeft);

    res.json({
      message: "Subscriptions expiring in 5 days",
      count: expiringUsers.length,
      users: expiringUsers,
    });
  } catch (error) {
    console.error("Error fetching expiring subscriptions:", error);
    res.status(500).json({message: "Internal server error"});
  }
}

