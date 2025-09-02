import connectDB from "../db/connectDB";
import mongoose from "mongoose";
import SubscriptionPlan from "./subscriptionPlan.model";

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  adharNumber: {
    type: Number,
    required: true,
    unique: true,
  },
  subscriptionPlan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "SubscriptionPlan",
    required: true,
  },
  joiningDate: {
    type: Date,
    default: Date.now,
  },
  feePaid: {
    type: Number,
    required: true,
    default: false,
  },
  seatNumber: {
    type: Number,
    required: true,
  },
  age: {
    type: Number,
  },
  address: {
    type: String,
  },
  idNumber: {
    type: Number,
    required: true,
  },
  isActive: {
    type: Boolean,
    default: false,
  },
});

const User = mongoose.model("User", UserSchema);
module.exports = User;
