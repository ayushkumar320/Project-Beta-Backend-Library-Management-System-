import express from "express";
import adminAuth from "../middlewares/admin.auth.js";
import {
  adminLogin,
  registerUser,
  createSubscriptionPlan,
  updateStudent,
  deleteStudent,
  updateSubscriptionPlan,
  deleteSubscriptionPlan,
  getSubscriptionPlans,
  getUsers,
  getDashboardCount,
  getSubscriptionEndingPlan,
} from "../controllers/admin.controller.js";

import {
  addSeat,
  updateSeat,
  deleteSeat,
  getSeatManagement,
  getAvailableSeats,
  getSeatInfo,
  cleanupInvalidSeats,
} from "../controllers/seatManagment.controller.js";

const router = express.Router();

router.post("/login", adminLogin);
router.post("/register", adminAuth, registerUser);
router.post("/subscription", adminAuth, createSubscriptionPlan);
router.put("/student/:adharNumber", adminAuth, updateStudent);
router.delete("/student/:adharNumber", adminAuth, deleteStudent);
router.put("/subscription", adminAuth, updateSubscriptionPlan);
router.delete("/subscription/:planId", adminAuth, deleteSubscriptionPlan);
router.get("/subscriptions", adminAuth, getSubscriptionPlans);
router.get("/users", adminAuth, getUsers);
router.get("/dashboard", getDashboardCount); // Temporarily remove auth for testing
router.get("/subscription-ending", adminAuth, getSubscriptionEndingPlan);

router.post("/seat", adminAuth, addSeat);
router.put("/seat/:seatNumber", adminAuth, updateSeat);
router.delete("/seat/:seatNumber", adminAuth, deleteSeat);
router.get("/seats", adminAuth, getSeatManagement);
router.get("/seats/available", adminAuth, getAvailableSeats);
router.get("/seat/:seatNumber", adminAuth, getSeatInfo);
router.get("/seats/cleanup", adminAuth, cleanupInvalidSeats);

export default router;
