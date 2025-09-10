import mongoose from "mongoose";

const SeatManegmentSchema = new mongoose.Schema({
  seatNumber: {
    type: String,
    required: true,
    unique: true,
  },
  students: [{
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    plan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubscriptionPlan",
      required: true,
    },
    slot: {
      type: String,
      enum: ["Morning", "Evening", "Full day", "24 Hour", "Short Slot"],
      required: true,
    },
    allocationDate: {
      type: Date,
      default: Date.now,
    },
    expirationDate: {
      type: Date,
      required: true,
    },
    status: {
      type: Boolean,
      default: true,
    },
  }],
  // Keep legacy fields for backward compatibility
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  plan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "SubscriptionPlan",
  },
  allocationDate: {
    type: Date,
    default: Date.now,
  },
  expirationDate: {
    type: Date,
  },
  status: {
    type: Boolean,
    default: true,
  },
});

const SeatManegment = mongoose.model("SeatManegment", SeatManegmentSchema);

export default SeatManegment;
