import User from "../models/user.model.js";
import SubscriptionPlan from "../models/subscriptionPlan.model.js";

// Simple utility functions for seat management
function validateSeatNumber(seatNumber) {
  // Simple validation: A1-A66 or B1-B99 (extended for more seats)
  const sectionARegex = /^A([1-9]|[1-5][0-9]|6[0-6])$/; // A1-A66
  const sectionBRegex = /^B([1-9]|[1-8][0-9]|9[0-9])$/; // B1-B99
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
      // Get available seats in Section B (B1 to B99)
      for (let i = 1; i <= 99; i++) {
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
        students: [],
      });
    }

    res.json({
      seatNumber: seatNumber,
      section: getSectionFromSeat(seatNumber),
      status: user.isActive ? "Occupied" : "Available",
      students: user.isActive ? [{
        name: user.name,
        plan: user.subscriptionPlan ? user.subscriptionPlan.planName : null,
        joiningDate: user.joiningDate,
        expiryDate: user.expiryDate,
        feePaid: user.feePaid,
        slot: user.slot,
        fatherName: user.fatherName,
        dateOfBirth: user.dateOfBirth,
      }] : [],
    });
  } catch (error) {
    console.error("Error fetching seat information:", error);
    res.status(500).json({message: "Internal server error"});
  }
}

export async function addSeat(req, res) {
  try {
    const { seatNumber } = req.body;

    // Simple validation: Check if seat number format is correct
    if (!validateSeatNumber(seatNumber)) {
      return res.status(400).json({
        message:
          "Invalid seat number. Use format A1-A66 for Section A or B1-B99 for Section B",
      });
    }

    // Allow adding a seat placeholder only if no active user occupies it
    const existingSeatUser = await User.findOne({ seatNumber, isActive: true });
    if (existingSeatUser) {
      return res.status(400).json({ message: "Seat number already exists" });
    }

    res.json({
      message: "Seat added successfully!",
      seatNumber: seatNumber,
      section: getSectionFromSeat(seatNumber),
      student: "Available",
      plan: "-",
    });
  } catch (error) {
    console.error("Error allocating seat:", error);
    res.status(500).json({
      message: "Internal server error",
    });
  }
}

export async function deleteSeat(req, res) {
  try {
    const { seatNumber } = req.params;

    // Simple validation: Check if seat number format is correct
    if (!validateSeatNumber(seatNumber)) {
      return res.status(400).json({
        message: "Invalid seat number format",
      });
    }

    // Check if seat is occupied by active user
    const existingSeatUser = await User.findOne({ seatNumber, isActive: true });
    if (existingSeatUser) {
      return res.status(400).json({ 
        message: "Cannot delete seat that is currently occupied by an active student" 
      });
    }

    // If seat exists but is not active, we can consider it deleted
    // (In a real scenario, you might want to actually remove the user record)
    res.json({
      message: "Seat deleted successfully!",
      seatNumber: seatNumber,
    });
  } catch (error) {
    console.error("Error deleting seat:", error);
    res.status(500).json({
      message: "Internal server error",
    });
  }
}

export async function updateSeat(req, res) {
  try {
    const seatNumber = req.params.seatNumber;
    const {studentName, planName, isActive, feePaid} = req.body;

    // First check if seat exists
    const existingUser = await User.findOne({seatNumber});
    if (!existingUser) {
      return res.status(404).json({
        message: "Seat not found",
      });
    }

    let updateData = {};

    if (studentName && planName) {
      // If assigning a new student to the seat
      const subscriptionPlan = await SubscriptionPlan.findOne({planName});
      if (!subscriptionPlan) {
        return res.status(404).json({
          message: "Subscription plan not found",
        });
      }

      // Prepare update data for new student assignment
      updateData = {
        name: studentName,
        subscriptionPlan: subscriptionPlan._id,
        isActive: isActive !== undefined ? isActive : true,
        feePaid: feePaid !== undefined ? feePaid : false,
        joiningDate: new Date(),
      };
    } else if (isActive !== undefined) {
      // Update seat status
      updateData = {
        isActive: isActive,
        feePaid: feePaid !== undefined ? feePaid : existingUser.feePaid,
      };

      // If making seat available (isActive = false), don't clear the user data
      // The seat will show as "Available" in the response but keep user history
    } else if (feePaid !== undefined) {
      // Only updating fee status
      updateData = {
        feePaid: feePaid,
      };
    } else {
      return res.status(400).json({
        message: "No valid update data provided",
      });
    }

    // Update using findOneAndUpdate
    const updatedUser = await User.findOneAndUpdate({seatNumber}, updateData, {
      new: true,
      runValidators: true,
    }).populate("subscriptionPlan", "planName duration");

    res.json({
      message: "Seat updated successfully!",
      seatNumber: seatNumber,
      student: updatedUser.name || "Available",
      plan: updatedUser.subscriptionPlan
        ? updatedUser.subscriptionPlan.planName
        : "-",
      status: updatedUser.isActive ? "Occupied" : "Available",
      feePaid: updatedUser.feePaid,
      joiningDate: updatedUser.joiningDate
        ? updatedUser.joiningDate.toISOString().split("T")[0]
        : "-",
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

    // Filter out users with invalid seat numbers (for data consistency)
    const validUsers = users.filter((user) =>
      validateSeatNumber(user.seatNumber)
    );

    // Calculate simple seat statistics (only for valid seats)
    const totalSeats = 165; // Section A (66) + Section B (99) = 165
    const occupiedSeats = validUsers.filter((user) => user.isActive).length;
    const availableSeats = totalSeats - occupiedSeats;

    // Section-wise statistics (only for valid seats)
    const sectionAOccupied = validUsers.filter(
      (user) =>
        user.seatNumber && user.seatNumber.startsWith("A") && user.isActive
    ).length;
    const sectionBOccupied = validUsers.filter(
      (user) =>
        user.seatNumber && user.seatNumber.startsWith("B") && user.isActive
    ).length;

    // Prepare seat data for frontend (only valid seats)
    const seatData = validUsers.map((user) => {
      let expirationDate = null;

      if (user.subscriptionPlan && user.joiningDate) {
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
        student: user.name || "Available",
        plan: user.subscriptionPlan ? user.subscriptionPlan.planName : "-",
        joiningDate: user.joiningDate
          ? user.joiningDate.toISOString().split("T")[0]
          : "-",
        expirationDate: expirationDate || "-",
        status: user.isActive ? "Occupied" : "Available",
        feePaid: user.feePaid || false,
        students: user.isActive ? [{
          name: user.name,
          plan: user.subscriptionPlan ? user.subscriptionPlan.planName : null,
          joiningDate: user.joiningDate ? user.joiningDate.toISOString().split("T")[0] : null,
          expiryDate: user.expiryDate ? user.expiryDate.toISOString().split("T")[0] : expirationDate,
          feePaid: user.feePaid,
          slot: user.slot,
          fatherName: user.fatherName,
          dateOfBirth: user.dateOfBirth ? user.dateOfBirth.toISOString().split("T")[0] : null,
        }] : [],
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
          total: 99,
          occupied: sectionBOccupied,
          available: 99 - sectionBOccupied,
        },
      },
      seats: seatData,
      invalidSeats: users
        .filter((user) => !validateSeatNumber(user.seatNumber))
        .map((user) => ({
          seatNumber: user.seatNumber,
          studentName: user.name,
          reason: "Invalid seat number format",
        })),
    });
  } catch (error) {
    console.error("Error fetching seat management data:", error);
    res.status(500).json({message: "Internal server error"});
  }
}

// Function to clean up invalid seat numbers (admin use)
export async function cleanupInvalidSeats(req, res) {
  try {
    // Find all users with invalid seat numbers
    const allUsers = await User.find();
    const invalidUsers = allUsers.filter(
      (user) => !validateSeatNumber(user.seatNumber)
    );

    if (invalidUsers.length === 0) {
      return res.json({
        message: "No invalid seats found",
        cleanedSeats: [],
      });
    }

    // You can either delete these users or update their seat numbers
    // For safety, let's just return the list for manual review
    const invalidSeatData = invalidUsers.map((user) => ({
      _id: user._id,
      seatNumber: user.seatNumber,
      studentName: user.name,
      isActive: user.isActive,
      reason: "Invalid seat number format - should be A1-A66 or B1-B39",
    }));

    res.json({
      message: `Found ${invalidUsers.length} invalid seat(s)`,
      invalidSeats: invalidSeatData,
      suggestion:
        "Please update these seat numbers to valid format (A1-A66 or B1-B39) or delete if they are test data",
    });
  } catch (error) {
    console.error("Error cleaning up invalid seats:", error);
    res.status(500).json({message: "Internal server error"});
  }
}
