import User from "../models/user.model.js";
import SubscriptionPlan from "../models/subscriptionPlan.model.js";

function validateSeatNumber(seatNumber) {
  const sectionA = /^A([1-9]|[1-5][0-9]|6[0-6])$/;
  const sectionB = /^B([1-9]|[1-2][0-9]|3[0-9])$/;
  return sectionA.test(seatNumber) || sectionB.test(seatNumber);
}
function getSectionFromSeat(seatNumber) {
  return seatNumber ? seatNumber.charAt(0) : null;
}

export async function getAvailableSeats(req, res) {
  try {
    const {section} = req.query;
    const active = await User.find({isActive: true}, {seatNumber: 1, _id: 0});
    const taken = new Set(active.map((u) => u.seatNumber));
    const out = [];
    const pushRange = (p, max) => {
      for (let i = 1; i <= max; i++) {
        const seat = p + i;
        if (!taken.has(seat)) out.push(seat);
      }
    };
    if (!section || section === "A") pushRange("A", 66);
    if (!section || section === "B") pushRange("B", 39);
    res.json({
      message: "Available seats retrieved successfully",
      availableSeats: out.sort(),
    });
  } catch (err) {
    console.error("getAvailableSeats error:", err);
    res.status(500).json({message: "Internal server error"});
  }
}

export async function getSeatInfo(req, res) {
  try {
    const {seatNumber} = req.params;
    if (!validateSeatNumber(seatNumber))
      return res.status(400).json({message: "Invalid seat number format"});
    const user = await User.findOne({seatNumber})
      .populate("subscriptionPlan", "planName duration")
      .exec();
    if (!user)
      return res.json({
        seatNumber,
        section: getSectionFromSeat(seatNumber),
        status: "Available",
        student: null,
      });
    res.json({
      seatNumber,
      section: getSectionFromSeat(seatNumber),
      status: user.isActive ? "Occupied" : "Available",
      student: user.name
        ? {
            name: user.name,
            plan: user.subscriptionPlan?.planName || null,
            joiningDate: user.joiningDate,
            feePaid: user.feePaid,
          }
        : null,
    });
  } catch (err) {
    console.error("getSeatInfo error:", err);
    res.status(500).json({message: "Internal server error"});
  }
}

export async function addSeat(req, res) {
  try {
    const {
      seatNumber,
      studentName,
      planName,
      adharNumber,
      age,
      address,
      idNumber,
    } = req.body;

    if (!validateSeatNumber(seatNumber))
      return res.status(400).json({
        message:
          "Invalid seat number. Use A1-A66 (A) or B1-B39 (B)",
      });

    if (await User.findOne({seatNumber}))
      return res.status(400).json({message: "Seat number already exists"});

    if (await User.findOne({adharNumber}))
      return res.status(400).json({message: "User with this Adhar number already exists"});

    const plan = await SubscriptionPlan.findOne({planName});
    if (!plan) return res.status(404).json({message: "Subscription plan not found"});

    const newUser = await User.create({
      name: studentName,
      adharNumber,
      subscriptionPlan: plan._id,
      joiningDate: new Date(),
      feePaid: false,
      seatNumber,
      age,
      address,
      idNumber,
      isActive: true,
    });

    res.json({
      message: "Seat allocated successfully!",
      seatNumber,
      section: getSectionFromSeat(seatNumber),
      student: studentName,
      plan: planName,
    });
  } catch (err) {
    console.error("addSeat error:", err);
    res.status(500).json({message: "Internal server error"});
  }
}

export async function updateSeat(req, res) {
  try {
    const {seatNumber} = req.params;
    const {studentName, planName, isActive, feePaid} = req.body;

    const existing = await User.findOne({seatNumber});
    if (!existing) return res.status(404).json({message: "Seat not found"});

    let updateData = {};

    if (studentName && planName) {
      const plan = await SubscriptionPlan.findOne({planName});
      if (!plan)
        return res.status(404).json({message: "Subscription plan not found"});
      updateData = {
        name: studentName,
        subscriptionPlan: plan._id,
        isActive: isActive !== undefined ? isActive : true,
        feePaid: feePaid !== undefined ? feePaid : false,
        joiningDate: new Date(),
      };
    } else if (isActive !== undefined) {
      updateData = {
        isActive,
        feePaid: feePaid !== undefined ? feePaid : existing.feePaid,
      };
    } else if (feePaid !== undefined) {
      updateData = {feePaid};
    } else {
      return res.status(400).json({message: "No valid update data provided"});
    }

    const updated = await User.findOneAndUpdate({seatNumber}, updateData, {
      new: true,
      runValidators: true,
    }).populate("subscriptionPlan", "planName duration");

    res.json({
      message: "Seat updated successfully!",
      seatNumber,
      student: updated.name || "Available",
      plan: updated.subscriptionPlan?.planName || "-",
      status: updated.isActive ? "Occupied" : "Available",
      feePaid: updated.feePaid,
      joiningDate: updated.joiningDate
        ? updated.joiningDate.toISOString().split("T")[0]
        : "-",
    });
  } catch (err) {
    console.error("updateSeat error:", err);
    res.status(500).json({message: "Internal server error"});
  }
}

export async function getSeatManagement(req, res) {
  try {
    const users = await User.find()
      .populate("subscriptionPlan", "planName duration")
      .sort({seatNumber: 1});

    const validUsers = users.filter((u) => validateSeatNumber(u.seatNumber));
    const totalSeats = 105;
    const occupiedSeats = validUsers.filter((u) => u.isActive).length;
    const availableSeats = totalSeats - occupiedSeats;

    const sectionAOccupied = validUsers.filter(
      (u) => u.seatNumber?.startsWith("A") && u.isActive
    ).length;
    const sectionBOccupied = validUsers.filter(
      (u) => u.seatNumber?.startsWith("B") && u.isActive
    ).length;

    const seats = validUsers.map((u) => {
      let expirationDate = "-";
      if (u.subscriptionPlan && u.joiningDate) {
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
        expirationDate = exp.toISOString().split("T")[0];
      }
      return {
        seatNumber: u.seatNumber,
        section: getSectionFromSeat(u.seatNumber),
        student: u.name || "Available",
        plan: u.subscriptionPlan?.planName || "-",
        joiningDate: u.joiningDate
          ? u.joiningDate.toISOString().split("T")[0]
          : "-",
        expirationDate,
        status: u.isActive ? "Occupied" : "Available",
        feePaid: !!u.feePaid,
      };
    });

    res.json({
      statistics: {
        totalSeats,
        occupiedSeats,
        availableSeats,
        sectionA: {
          total: 66,
          occupied: sectionAOccupied,
          available: 66 - sectionAOccupied,
        },
        sectionB: {
          total: 39,
          occupied: sectionBOccupied,
          available: 39 - sectionBOccupied,
        },
      },
      seats,
      invalidSeats: users
        .filter((u) => !validateSeatNumber(u.seatNumber))
        .map((u) => ({
          seatNumber: u.seatNumber,
          studentName: u.name,
          reason: "Invalid seat number format",
        })),
    });
  } catch (err) {
    console.error("getSeatManagement error:", err);
    res.status(500).json({message: "Internal server error"});
  }
}

export async function cleanupInvalidSeats(req, res) {
  try {
    const all = await User.find();
    const invalid = all.filter((u) => !validateSeatNumber(u.seatNumber));
    if (invalid.length === 0)
      return res.json({message: "No invalid seats found", cleanedSeats: []});
    res.json({
      message: `Found ${invalid.length} invalid seat(s)`,
      invalidSeats: invalid.map((u) => ({
        _id: u._id,
        seatNumber: u.seatNumber,
        studentName: u.name,
        isActive: u.isActive,
        reason: "Invalid seat number format - should be A1-A66 or B1-B39",
      })),
      suggestion:
        "Update these seat numbers to valid format or delete if test data",
    });
  } catch (err) {
    console.error("cleanupInvalidSeats error:", err);
    res.status(500).json({message: "Internal server error"});
  }
}