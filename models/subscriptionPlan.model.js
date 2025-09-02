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
  status: {
    type: Boolean,
    default: false,
  },
});

const SubscriptionPlan = mongoose.model(
  "subscriptionPlan",
  SubscriptionPlanSchema
);
export default SubscriptionPlan;
