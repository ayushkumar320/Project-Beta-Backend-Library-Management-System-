import connectDB from "../db/connectDB";
import mongoose from "mongoose";

const SubscriptionPlanSchema = new mongoose.Schema({
  planName: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  duration: {
    type: String,
    required: true,
  },
  subscribers: {
    type: Number,
    default: 0,
  },
  Status: {
    type: Boolean,
    default: Inactive,
  },
});

const subscriptionPlan = mongoose.model(
  "subscriptionPlan",
  SubscriptionPlanSchema
);
module.exports = subscriptionPlan;
