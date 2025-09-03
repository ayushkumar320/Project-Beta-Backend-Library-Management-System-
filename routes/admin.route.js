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
} from "../controllers/seatManagment.controller.js";

const router = express.Router();

router.post("/login", adminLogin);
router.post("/register", adminAuth, registerUser);
router.post("/subscription", adminAuth, createSubscriptionPlan);
router.put("/student", adminAuth, updateStudent);
router.put("/subscription", adminAuth, updateSubscriptionPlan);
router.get("/subscriptions", adminAuth, getSubscriptionPlans);
router.get("/users", adminAuth, getUsers);
router.get("/dashboard", adminAuth, getDashboardCount);
router.get("/subscription-ending", adminAuth, getSubscriptionEndingPlan);

router.post("/seat", adminAuth, addSeat);
router.put("/seat/:seatNumber", adminAuth, updateSeat);
router.get("/seats", adminAuth, getSeatManagement);

export default router;
