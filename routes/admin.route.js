import express from "express";
import adminAuth from "../middlewares/admin.auth.js";
import {
  adminLogin,
  registerUser,
  createSubscriptionPlan,
  updateStudent,
  updateSubscriptionPlan,
  getSubscriptionPlans,
  getUsers,
  getDashboardCount,
  getSubscriptionEndingPlan,
} from "../controllers/admin.controller.js";

import {
  addSeat,
  updateSeat,
  getSeatManagement,
  getAvailableSeats,
  getSeatInfo,
  cleanupInvalidSeats,
} from "../controllers/seatManagment.controller.js";

const router = express.Router();

// Test endpoint for debugging
router.get("/test", (req, res) => {
  res.json({
    message: "API is working",
    environment: process.env.NODE_ENV,
    hasJwtSecret: !!process.env.JWT_SECRET,
    hasMongoUri: !!process.env.MONGODB_URI,
    timestamp: new Date().toISOString()
  });
});

router.post("/login", adminLogin);
router.post("/register", adminAuth, registerUser);
router.post("/subscription", adminAuth, createSubscriptionPlan);
router.put("/student/:adharNumber", adminAuth, updateStudent);
router.put("/subscription", adminAuth, updateSubscriptionPlan);
router.get("/subscriptions", adminAuth, getSubscriptionPlans);
router.get("/users", adminAuth, getUsers);
router.get("/dashboard", getDashboardCount); // Temporarily remove auth for testing
router.get("/subscription-ending", adminAuth, getSubscriptionEndingPlan);

router.post("/seat", adminAuth, addSeat);
router.put("/seat/:seatNumber", adminAuth, updateSeat);
router.get("/seats", adminAuth, getSeatManagement);
router.get("/seats/available", adminAuth, getAvailableSeats);
router.get("/seat/:seatNumber", adminAuth, getSeatInfo);
router.get("/seats/cleanup", adminAuth, cleanupInvalidSeats);

export default router;
