import jwt from "jsonwebtoken";
import Admin from "../models/admin.model.js";
import User from "../models/user.model.js";
import SubscriptionPlan from "../models/subscriptionPlan.model.js";
import bcrypt from "bcrypt";

export async function adminLogin(req, res) {
  try {
    const {email, password} = req.body;
    if (!email || !password)
      return res.status(400).json({message: "Email and password are required"});

    const admin = await Admin.findOne({email});
    if (!admin) return res.status(404).json({message: "Admin not found"});

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch)
      return res.status(401).json({message: "Invalid credentials"});

    if (!process.env.JWT_SECRET)
      return res.status(500).json({message: "Server configuration error"});

    const token = jwt.sign(
      {_id: admin._id, role: "admin"},
      process.env.JWT_SECRET,
      {expiresIn: "12h"}
    );
    res.json({token});
  } catch (err) {
    console.error("adminLogin error:", err);
    res.status(500).json({message: "Internal server error"});
  }
}

export async function registerUser(req, res) {
  try {
    let {
      name,
      adharNumber,
      subscriptionPlan, // could be plan _id or planName
      joiningDate,
      feePaid,
      seatNumber,
      age,
      address,
      idNumber,
      isActive,
    } = req.body;

    if (!name || !adharNumber)
      return res.status(400).json({message: "Name and adharNumber required"});

    const exists = await User.findOne({adharNumber});
    if (exists) return res.status(400).json({message: "User already exists"});

    let planId = null;
    if (subscriptionPlan) {
      if (/^[a-fA-F0-9]{24}$/.test(subscriptionPlan)) {
        planId = subscriptionPlan;
      } else {
        const planDoc = await SubscriptionPlan.findOne({planName: subscriptionPlan});
        if (!planDoc)
          return res.status(404).json({message: "Subscription plan not found"});
        planId = planDoc._id;
      }
    }

    const user = await User.create({
      name,
      adharNumber,
      subscriptionPlan: planId,
      joiningDate: joiningDate ? new Date(joiningDate) : new Date(),
      feePaid: !!feePaid,
      seatNumber,
      age,
      address,
      idNumber,
      isActive: isActive ?? true,
    });

    if (planId) {
      await SubscriptionPlan.findByIdAndUpdate(planId, {$push: {subscribers: user._id}});
    }

    res.status(201).json({message: "User registered successfully", userId: user._id});
  } catch (err) {
    console.error("registerUser error:", err);
    res.status(500).json({message: "Internal server error"});
  }
}

export async function updateStudent(req, res) {
  try {
    const {adharNumber} = req.params;
    const adharNumberAsNumber = parseInt(adharNumber);
    if (isNaN(adharNumberAsNumber))
      return res.status(400).json({message: "Invalid adharNumber format"});

    const existing = await User.findOne({adharNumber: adharNumberAsNumber});
    if (!existing) return res.status(404).json({message: "User not found"});

    const {subscriptionPlan} = req.body;
    let planId = subscriptionPlan;
    if (subscriptionPlan && !/^[a-fA-F0-9]{24}$/.test(subscriptionPlan)) {
      const planDoc = await SubscriptionPlan.findOne({planName: subscriptionPlan});
      if (!planDoc)
        return res.status(404).json({message: "Subscription plan not found"});
      planId = planDoc._id;
    }

    const oldPlan = existing.subscriptionPlan?.toString();
    const updated = await User.findOneAndUpdate(
      {adharNumber: adharNumberAsNumber},
      {...req.body, subscriptionPlan: planId},
      {new: true}
    );

    if (!updated) return res.status(404).json({message: "User not found"});

    if (planId && planId.toString() !== oldPlan) {
      if (oldPlan) {
        await SubscriptionPlan.findByIdAndUpdate(oldPlan, {$pull: {subscribers: existing._id}});
      }
      await SubscriptionPlan.findByIdAndUpdate(planId, {$push: {subscribers: existing._id}});
    }

    res.json({
      message: "User updated successfully",
      name: updated.name,
      adharNumber: updated.adharNumber,
    });
  } catch (err) {
    console.error("updateStudent error:", err);
    res.status(500).json({message: "Internal server error"});
  }
}

export async function createSubscriptionPlan(req, res) {
  try {
    const {planName, price, duration, subscribers, status} = req.body;
    const exists = await SubscriptionPlan.findOne({planName});
    if (exists) return res.status(400).json({message: "Plan already exists"});
    const plan = await SubscriptionPlan.create({
      planName,
      price,
      duration,
      subscribers,
      status,
    });
    res.json({message: "New subscription plan added!", planId: plan._id});
  } catch (err) {
    console.error("createSubscriptionPlan error:", err);
    res.status(500).json({message: "Internal server error"});
  }
}

export async function updateSubscriptionPlan(req, res) {
  try {
    const {planName, price, duration, subscribers, status} = req.body;
    const updated = await SubscriptionPlan.findOneAndUpdate(
      {planName},
      {price, duration, subscribers, status},
      {new: true}
    );
    if (!updated)
      return res.status(404).json({message: "Subscription plan not found"});
    res.json({message: "Subscription plan updated successfully", planName: updated.planName});
  } catch (err) {
    console.error("updateSubscriptionPlan error:", err);
    res.status(500).json({message: "Internal server error"});
  }
}

export async function getSubscriptionPlans(req, res) {
  try {
    const plans = await SubscriptionPlan.find();
    res.json(plans);
  } catch (err) {
    console.error("getSubscriptionPlans error:", err);
    res.status(500).json({message: "Internal server error"});
  }
}

export async function getUsers(req, res) {
  try {
    const users = await User.find();
    res.json(users);
  } catch (err) {
    console.error("getUsers error:", err);
    res.status(500).json({message: "Internal server error"});
  }
}

export async function getDashboardCount(req, res) {
  try {
    const totalStudents = await User.countDocuments();
    const activeUsers = await User.countDocuments({isActive: true});
    const totalPlans = await SubscriptionPlan.countDocuments();
    const occupiedSeats = activeUsers;
    const totalCapacity = 105;
    const availableSeats = totalCapacity - occupiedSeats;

    const active = await User.find({isActive: true}).populate(
      "subscriptionPlan",
      "duration"
    );

    let expiringSoon = 0;
    const now = new Date();
    for (const u of active) {
      if (!u.subscriptionPlan || !u.joiningDate) continue;
      const jd = new Date(u.joiningDate);
      const dur = u.subscriptionPlan.duration.toLowerCase();
      let exp = new Date(jd);
      if (dur.includes("day")) exp.setDate(jd.getDate() + parseInt(dur));
      else if (dur.includes("week"))
        exp.setDate(jd.getDate() + parseInt(dur) * 7);
      else if (dur.includes("month"))
        exp.setMonth(jd.getMonth() + parseInt(dur));
      else if (dur.includes("year"))
        exp.setFullYear(jd.getFullYear() + parseInt(dur));
      const diffDays = Math.ceil((exp - now) / (1000 * 3600 * 24));
      if (diffDays > 0 && diffDays <= 5) expiringSoon++;
    }

    res.json({
      totalStudents,
      availableSeats,
      expiringSoon,
      activeUsers,
      totalPlans,
      message: "Dashboard data retrieved successfully",
    });
  } catch (err) {
    console.error("getDashboardCount error:", err);
    res.status(500).json({message: "Internal server error"});
  }
}

export async function getSubscriptionEndingPlan(req, res) {
  try {
    const today = new Date();
    const active = await User.find({isActive: true}).populate(
      "subscriptionPlan",
      "planName duration"
    );

    const expiringUsers = [];
    for (const u of active) {
      if (!u.subscriptionPlan || !u.joiningDate) continue;
      const jd = new Date(u.joiningDate);
      const dur = u.subscriptionPlan.duration.toLowerCase();
      let exp = new Date(jd);
      if (dur.includes("day")) exp.setDate(jd.getDate() + parseInt(dur));
      else if (dur.includes("week"))
        exp.setDate(jd.getDate() + parseInt(dur) * 7);
      else if (dur.includes("month"))
        exp.setMonth(jd.getMonth() + parseInt(dur));
      else if (dur.includes("year"))
        exp.setFullYear(jd.getFullYear() + parseInt(dur));
      const daysLeft = Math.ceil((exp - today) / (1000 * 3600 * 24));
      if (daysLeft > 0 && daysLeft <= 5) {
        expiringUsers.push({
          name: u.name,
            seatNumber: u.seatNumber,
          expirationDate: exp.toISOString().split("T")[0],
          daysLeft,
          planName: u.subscriptionPlan.planName,
        });
      }
    }
    expiringUsers.sort((a, b) => a.daysLeft - b.daysLeft);
    res.json({
      message: "Subscriptions expiring in 5 days",
      count: expiringUsers.length,
      users: expiringUsers,
    });
  } catch (err) {
    console.error("getSubscriptionEndingPlan error:", err);
    res.status(500).json({message: "Internal server error"});
  }
}