import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  // Morning | Evening | Full day | 24 Hour
  slot: {
    type: String,
    enum: ["Morning", "Evening", "Full day", "24 Hour", "Short Slot"],
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
  expiryDate: {
    type: Date,
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
  dateOfBirth: {
    type: Date,
  },
  fatherName: {
    type: String,
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
    unique: true,
    sparse: true, // Allows multiple null values
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
