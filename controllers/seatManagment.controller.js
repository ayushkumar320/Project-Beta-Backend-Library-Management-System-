import User from "../models/user.model.js";
import SubscriptionPlan from "../models/subscriptionPlan.model.js";

// Simple utility functions for seat management
function validateSeatNumber(seatNumber) {
  // Simple validation: A1-A66 or B1-B39
  const sectionARegex = /^A([1-9]|[1-5][0-9]|6[0-6])$/; // A1-A66
  const sectionBRegex = /^B([1-9]|[1-2][0-9]|3[0-9])$/; // B1-B39
  return sectionARegex.test(seatNumber) || sectionBRegex.test(seatNumber);
}

function getSectionFromSeat(seatNumber) {
  return seatNumber ? seatNumber.charAt(0) : null;
}

// Get available seat numbers for frontend dropdown
export async function getAvailableSeats(req, res) {
  try {
    const {section} = req.query; // Optional: filter by section A or B

    let availableSeats = [];

    if (!section || section === "A") {
      // Get available seats in Section A (A1 to A66)
      for (let i = 1; i <= 66; i++) {
        const seatNumber = `A${i}`;
        const existingSeat = await User.findOne({seatNumber, isActive: true});
        if (!existingSeat) {
          availableSeats.push(seatNumber);
        }
      }
    }

    if (!section || section === "B") {
      // Get available seats in Section B (B1 to B39)
      for (let i = 1; i <= 39; i++) {
        const seatNumber = `B${i}`;
        const existingSeat = await User.findOne({seatNumber, isActive: true});
        if (!existingSeat) {
          availableSeats.push(seatNumber);
        }
      }
    }

    res.json({
      message: "Available seats retrieved successfully",
      availableSeats: availableSeats.sort(),
    });
  } catch (error) {
    console.error("Error fetching available seats:", error);
    res.status(500).json({message: "Internal server error"});
  }
}

// Simple function to get seat information
export async function getSeatInfo(req, res) {
  try {
    const {seatNumber} = req.params;

    if (!validateSeatNumber(seatNumber)) {
      return res.status(400).json({
        message: "Invalid seat number format",
      });
    }

    const user = await User.findOne({seatNumber})
      .populate("subscriptionPlan", "planName duration")
      .exec();

    if (!user) {
      return res.json({
        seatNumber: seatNumber,
        section: getSectionFromSeat(seatNumber),
        status: "Available",
        student: null,
      });
    }

    res.json({
      seatNumber: seatNumber,
      section: getSectionFromSeat(seatNumber),
      status: user.isActive ? "Occupied" : "Available",
      student: user.isActive
        ? {
            name: user.name,
            plan: user.subscriptionPlan ? user.subscriptionPlan.planName : null,
            joiningDate: user.joiningDate,
            feePaid: user.feePaid,
          }
        : null,
    });
  } catch (error) {
    console.error("Error fetching seat information:", error);
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

    // Simple validation: Check if seat number format is correct
    if (!validateSeatNumber(seatNumber)) {
      return res.status(400).json({
        message:
          "Invalid seat number. Use format A1-A66 for Section A or B1-B39 for Section B",
      });
    }

    // Check if seat number is already taken
    const existingSeat = await User.findOne({seatNumber});
    if (existingSeat) {
      return res.status(400).json({
        message: "Seat number already exists",
      });
    }

    // Check if Adhar number already exists
    const existingUser = await User.findOne({adharNumber});
    if (existingUser) {
      return res.status(400).json({
        message: "User with this Adhar number already exists",
      });
    }

    // Find subscription plan
    const subscriptionPlan = await SubscriptionPlan.findOne({planName});
    if (!subscriptionPlan) {
      return res.status(404).json({
        message: "Subscription plan not found",
      });
    }

    // Create new user with seat assignment
    const newUser = new User({
      name: studentName,
      adharNumber,
      subscriptionPlan: subscriptionPlan._id,
      joiningDate: new Date(),
      feePaid: false,
      seatNumber,
      age,
      address,
      idNumber,
      isActive: true,
    });

    await newUser.save();

    res.json({
      message: "Seat allocated successfully!",
      seatNumber: seatNumber,
      section: getSectionFromSeat(seatNumber),
      student: studentName,
      plan: planName,
    });
  } catch (error) {
    console.error("Error allocating seat:", error);
    res.status(500).json({
      message: "Internal server error",
    });
  }
}

export async function updateSeat(req, res) {
  try {
    const seatNumber = req.params.seatNumber;
    const {studentName, planName, isActive, feePaid} = req.body;

    const existingUser = await User.findOne({seatNumber});
    if (!existingUser) {
      return res.status(404).json({
        message: "Seat not found",
      });
    }

    if (studentName && planName) {
      // If assigning a new student to the seat
      const subscriptionPlan = await SubscriptionPlan.findOne({planName});
      if (!subscriptionPlan) {
        return res.status(404).json({
          message: "Subscription plan not found",
        });
      }

      // Update the user's information
      existingUser.name = studentName;
      existingUser.subscriptionPlan = subscriptionPlan._id;
      existingUser.isActive = isActive !== undefined ? isActive : true;
      existingUser.feePaid = feePaid !== undefined ? feePaid : false;
      existingUser.joiningDate = new Date();
    } else {
      // Just update seat status (e.g., make available)
      existingUser.isActive = isActive !== undefined ? isActive : false;
      existingUser.feePaid =
        feePaid !== undefined ? feePaid : existingUser.feePaid;
    }

    await existingUser.save();

    res.json({
      message: "Seat updated successfully!",
      seatNumber: seatNumber,
      student: existingUser.name,
      status: existingUser.isActive ? "Occupied" : "Available",
    });
  } catch (error) {
    console.error("Error updating seat:", error);
    res.status(500).json({
      message: "Internal server error",
    });
  }
}

// For seat management - GET request (simplified)
export async function getSeatManagement(req, res) {
  try {
    // Get all users with their subscription plans populated
    const users = await User.find()
      .populate("subscriptionPlan", "planName duration")
      .sort({seatNumber: 1})
      .exec();

    // Calculate simple seat statistics
    const totalSeats = 105; // Section A (66) + Section B (39) = 105
    const occupiedSeats = await User.countDocuments({isActive: true});
    const availableSeats = totalSeats - occupiedSeats;

    // Section-wise statistics
    const sectionAOccupied = await User.countDocuments({
      seatNumber: {$regex: /^A/},
      isActive: true,
    });
    const sectionBOccupied = await User.countDocuments({
      seatNumber: {$regex: /^B/},
      isActive: true,
    });

    // Prepare seat data for frontend
    const seatData = users.map((user) => {
      let expirationDate = null;

      if (user.subscriptionPlan && user.isActive) {
        // Calculate expiration date
        const joiningDate = new Date(user.joiningDate);
        const planDuration = user.subscriptionPlan.duration;
        const durationLower = planDuration.toLowerCase();

        let expDate = new Date(joiningDate);

        if (durationLower.includes("day")) {
          const days = parseInt(planDuration.match(/\d+/)[0]);
          expDate.setDate(joiningDate.getDate() + days);
        } else if (durationLower.includes("week")) {
          const weeks = parseInt(planDuration.match(/\d+/)[0]);
          expDate.setDate(joiningDate.getDate() + weeks * 7);
        } else if (durationLower.includes("month")) {
          const months = parseInt(planDuration.match(/\d+/)[0]);
          expDate.setMonth(joiningDate.getMonth() + months);
        } else if (durationLower.includes("year")) {
          const years = parseInt(planDuration.match(/\d+/)[0]);
          expDate.setFullYear(joiningDate.getFullYear() + years);
        }

        expirationDate = expDate.toISOString().split("T")[0];
      }

      return {
        seatNumber: user.seatNumber,
        section: getSectionFromSeat(user.seatNumber),
        student: user.isActive ? user.name : "Available",
        plan:
          user.isActive && user.subscriptionPlan
            ? user.subscriptionPlan.planName
            : "-",
        joiningDate: user.isActive
          ? user.joiningDate.toISOString().split("T")[0]
          : "-",
        expirationDate: expirationDate || "-",
        status: user.isActive ? "Occupied" : "Available",
        feePaid: user.feePaid,
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
      seats: seatData,
    });
  } catch (error) {
    console.error("Error fetching seat management data:", error);
    res.status(500).json({message: "Internal server error"});
  }
}
