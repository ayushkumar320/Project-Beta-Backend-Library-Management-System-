import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  // Morning | Evening | Full day | 24 Hour
  slot: {
    type: String,
    enum: ["Morning", "Evening", "Full day", "24 Hour"],
  },
  adharNumber: {
    type: Number,
    required: true,
    unique: true,
  },
  // change the schema to get direct subscription Plan
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
    type: Boolean,
    default: false,
  },
  seatNumber: {
    type: String,
    required: true,
    unique: true,
  },
  age: {
    type: Number,
  },
  address: {
    type: String,
  },
  examPreparingFor: {
    type: String,
  },
  schoolOrCollegeName: {
    type: String,
  },
  idNumber: {
    type: Number,
    required: true,
    unique: true,
  },
  isActive: {
    type: Boolean,
    default: false,
  },
  // Adds ₹100/month when true (billing handled on client or separate service)
  lockerService: {
    type: Boolean,
    default: false,
  },
});

const User = mongoose.model("User", UserSchema);
export default User;
