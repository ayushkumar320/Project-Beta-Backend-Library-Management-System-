import jwt from "jsonwebtoken";
import Admin from "../models/admin.model.js";
import User from "../models/user.model.js";
import SubscriptionPlan from "../models/subscriptionPlan.model.js";
import connectDB from "../db/connectDB.js";
import dotenv from "dotenv";
dotenv.config();

const secret = process.env.JWT_SECRET;

export async function adminLogin(req, res) {
  const {email, password} = req.body;

  try {
    // Ensure database connection
    await connectDB();

    // Input validation
    if (!email || !password) {
      return res.status(400).json({message: "Email and password are required"});
    }

    const admin = await Admin.findOne({email});
    if (!admin) {
      return res.status(404).json({message: "Admin not found"});
    }
    if (admin.password !== password) {
      return res.status(401).json({message: "Invalid credentials"});
    }

    // Check if JWT_SECRET exists
    if (!secret) {
      console.error("JWT_SECRET is not defined");
      return res.status(500).json({message: "Server configuration error"});
    }

    const token = jwt.sign({_id: admin._id}, secret);
    res.json({token});
  } catch (error) {
    console.error("Error logging in admin:", error);
    res
      .status(500)
      .json({message: "Internal server error occured", error: error.message});
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
    // Ensure database connection
    await connectDB();
    const existingUser = await User.findOne({
      $or: [{ adharNumber }, { idNumber }, { seatNumber }],
    });
    if (existingUser) {
      if (existingUser.adharNumber === adharNumber) {
        return res
          .status(400)
          .json({ message: "User with this Aadhar number already exists" });
      } else if (existingUser.idNumber === idNumber) {
        return res
          .status(400)
          .json({ message: "User with this ID number already exists" });
      } else if (existingUser.seatNumber === seatNumber) {
        return res
          .status(400)
          .json({ message: "This seat is already occupied" });
      }
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

    // Add user to the subscription plan's subscribers list
    if (subscriptionPlan) {
      await SubscriptionPlan.findByIdAndUpdate(
        subscriptionPlan,
        {$push: {subscribers: user._id}},
        {new: true}
      );
    }

    res.status(201).json({message: "User registered successfully"});
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({message: "Internal server error"});
  }
}

export async function createSubscriptionPlan(req, res) {
  const {planName, price, duration, subscribers, status} = req.body;
  try {
    // Ensure database connection
    await connectDB();
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
    subscriptionPlan,
    joiningDate,
    feePaid,
    seatNumber,
    age,
    address,
    idNumber,
    isActive,
  } = req.body;

  // Get adharNumber from URL parameters and convert to number
  const {adharNumber} = req.params;
  const adharNumberAsNumber = parseInt(adharNumber);

  // Validate adharNumber
  if (isNaN(adharNumberAsNumber)) {
    return res.status(400).json({message: "Invalid adharNumber format"});
  }

  try {
    // Ensure database connection
    await connectDB();
    const user = await User.findOne({adharNumber: adharNumberAsNumber});

    if (!user) {
      return res.status(404).json({message: "User not found"});
    }

    const oldSubscriptionPlan = user.subscriptionPlan;

    const updatedUser = await User.findOneAndUpdate(
      {adharNumber: adharNumberAsNumber},
      {
        name,
        subscriptionPlan,
        joiningDate,
        feePaid,
        seatNumber,
        age,
        address,
        idNumber,
        isActive,
      },
      {new: true}
    );

    if (!updatedUser) {
      return res.status(404).json({message: "User not found"});
    }

    // Update subscription plan if it has changed
    if (
      subscriptionPlan &&
      subscriptionPlan.toString() !== oldSubscriptionPlan.toString()
    ) {
      // Remove user from old subscription plan
      if (oldSubscriptionPlan) {
        await SubscriptionPlan.findByIdAndUpdate(
          oldSubscriptionPlan,
          {$pull: {subscribers: user._id}},
          {new: true}
        );
      }

      // Add user to new subscription plan
      await SubscriptionPlan.findByIdAndUpdate(
        subscriptionPlan,
        {$push: {subscribers: user._id}},
        {new: true}
      );
    }

    res.json({
      name: updatedUser.name,
      adharNumber: updatedUser.adharNumber,
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
    // Ensure database connection
    await connectDB();
    const updatedPlan = await SubscriptionPlan.findOneAndUpdate(
      {planName},
      {price, duration, subscribers, status},
      {new: true}
    );

    if (!updatedPlan) {
      return res.status(404).json({message: "Subscription plan not found"});
    }

    res.json({
      message: "Subscription plan updated successfully",
      planName: updatedPlan.planName,
    });
  } catch (error) {
    console.error("Error updating subscription plan:", error);
    res.status(500).json({message: "Internal server error"});
  }
}

// GET Controllers

export async function getSubscriptionPlans(req, res) {
  try {
    // Ensure database connection
    await connectDB();
    const plans = await SubscriptionPlan.find();
    res.json(plans);
  } catch (error) {
    console.error("Error fetching subscription plans:", error);
    res.status(500).json({message: "Internal server error"});
  }
}

export async function getUsers(req, res) {
  try {
    // Ensure database connection
    await connectDB();
    const users = await User.find();
    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({message: "Internal server error"});
  }
}

export async function getDashboardCount(req, res) {
  try {
    // Ensure database connection
    await connectDB();
    // Get total number of users
    const totalStudents = await User.countDocuments();

    // Get total number of active users
    const activeUsers = await User.countDocuments({isActive: true});

    // Get total number of subscription plans
    const totalPlans = await SubscriptionPlan.countDocuments();

    // Calculate available seats (assuming total capacity and occupied seats)
    const occupiedSeats = await User.countDocuments({isActive: true});
    // Total capacity: Section A (66) + Section B (39) = 105 seats
    const totalCapacity = 105;
    const availableSeats = totalCapacity - occupiedSeats;

    // Calculate expiring soon (subscriptions expiring in next 5 days)
    const today = new Date();
    const users = await User.find({isActive: true})
      .populate("subscriptionPlan", "planName duration")
      .exec();

    let expiringSoon = 0;

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
        expiringSoon++;
      }
    }

    res.json({
      totalStudents,
      availableSeats,
      expiringSoon,
      activeUsers,
      totalPlans,
      message: "Dashboard data retrieved successfully",
    });
  } catch (error) {
    console.error("Error in getDashboardCount:", error);
    res
      .status(500)
      .json({message: "Internal server error", error: error.message});
  }
}

export async function getSubscriptionEndingPlan(req, res) {
  try {
    // Ensure database connection
    await connectDB();
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
