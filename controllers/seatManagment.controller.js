import User from "../models/user.model.js";
import SubscriptionPlan from "../models/subscriptionPlan.model.js";

// Simple utility functions for seat management
function validateSeatNumber(seatNumber) {
  // Dynamic validation: Any positive number for sections A or B
  const sectionRegex = /^[AB]([1-9]\d*)$/; // A1+, B1+ (any positive number)
  return sectionRegex.test(seatNumber);
}

function getSectionFromSeat(seatNumber) {
  return seatNumber ? seatNumber.charAt(0) : null;
}

// Initialize default seats for sections
export async function initializeDefaultSeats(req, res) {
  try {
    // Check if Section B already has seats
    const existingBSeats = await User.find({
      seatNumber: {$regex: /^B\d+$/},
    }).countDocuments();

    if (existingBSeats === 0) {
      // Initialize Section B with 39 default seats (all available)
      const defaultSeats = [];
      for (let i = 1; i <= 39; i++) {
        defaultSeats.push({
          seatNumber: `B${i}`,
          isActive: false, // Available by default
          joiningDate: new Date(),
          // Don't set name for empty seats - will show as "Available"
        });
      }

      await User.insertMany(defaultSeats);
      console.log("Initialized Section B with 39 default seats");
    }

    res.json({
      message: "Default seats initialized successfully",
      sectionBSeats: 39,
    });
  } catch (error) {
    console.error("Error initializing default seats:", error);
    res.status(500).json({message: "Internal server error"});
  }
}

// Get available seat numbers for frontend dropdown
export async function getAvailableSeats(req, res) {
  try {
    const {section} = req.query; // Optional: filter by section A or B

    let availableSeats = [];

    // Get all existing seats from database to determine the range dynamically
    const allSeats = await User.find({}, "seatNumber isActive");

    if (!section || section === "A") {
      // Find max seat number for Section A
      const sectionASeats = allSeats
        .filter((seat) => seat.seatNumber && seat.seatNumber.startsWith("A"))
        .map((seat) => parseInt(seat.seatNumber.substring(1)))
        .filter((num) => !isNaN(num));

      const maxA = sectionASeats.length > 0 ? Math.max(...sectionASeats) : 0;

      // Get available seats in Section A up to the maximum found
      for (let i = 1; i <= maxA; i++) {
        const seatNumber = `A${i}`;
        const existingSeat = allSeats.find(
          (seat) => seat.seatNumber === seatNumber && seat.isActive
        );
        if (!existingSeat) {
          availableSeats.push(seatNumber);
        }
      }
    }

    if (!section || section === "B") {
      // Find max seat number for Section B, default to 39 if no seats exist
      const sectionBSeats = allSeats
        .filter((seat) => seat.seatNumber && seat.seatNumber.startsWith("B"))
        .map((seat) => parseInt(seat.seatNumber.substring(1)))
        .filter((num) => !isNaN(num));

      const maxB = sectionBSeats.length > 0 ? Math.max(...sectionBSeats) : 39; // Default to 39

      // Get available seats in Section B up to the maximum found (minimum 39)
      for (let i = 1; i <= Math.max(maxB, 39); i++) {
        const seatNumber = `B${i}`;
        const existingSeat = allSeats.find(
          (seat) => seat.seatNumber === seatNumber && seat.isActive
        );
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
      students: user.isActive
        ? [
            {
              name: user.name,
              plan: user.subscriptionPlan
                ? user.subscriptionPlan.planName
                : null,
              joiningDate: user.joiningDate,
              expiryDate: user.expiryDate,
              feePaid: user.feePaid,
              slot: user.slot,
              fatherName: user.fatherName,
              dateOfBirth: user.dateOfBirth,
            },
          ]
        : [],
    });
  } catch (error) {
    console.error("Error fetching seat information:", error);
    res.status(500).json({message: "Internal server error"});
  }
}

export async function addSeat(req, res) {
  try {
    const {seatNumber} = req.body;

    // Simple validation: Check if seat number format is correct
    if (!validateSeatNumber(seatNumber)) {
      return res.status(400).json({
        message:
          "Invalid seat number. Use format A{number} for Section A or B{number} for Section B (e.g., A1, B1, A100, B50)",
      });
    }

    // Check if any user already has this seat number (active or inactive)
    const existingSeatUser = await User.findOne({seatNumber});
    if (existingSeatUser) {
      return res.status(400).json({message: "Seat number already exists"});
    }

    // Create a new seat record (inactive/available by default)
    const newSeat = new User({
      seatNumber: seatNumber,
      isActive: false, // Available by default
      joiningDate: new Date(),
      // Don't set name for empty seats - will show as "Available"
    });

    await newSeat.save();

    res.json({
      message: "Seat added successfully!",
      seatNumber: seatNumber,
      section: getSectionFromSeat(seatNumber),
      student: "Available",
      plan: "-",
    });
  } catch (error) {
    console.error("Error adding seat:", error);
    res.status(500).json({
      message: "Internal server error",
    });
  }
}

export async function deleteSeat(req, res) {
  try {
    const {seatNumber} = req.params;

    // Simple validation: Check if seat number format is correct
    if (!validateSeatNumber(seatNumber)) {
      return res.status(400).json({
        message: "Invalid seat number format",
      });
    }

    // Check if seat is occupied by active user
    const existingSeatUser = await User.findOne({seatNumber, isActive: true});
    if (existingSeatUser) {
      return res.status(400).json({
        message:
          "Cannot delete seat that is currently occupied by an active student",
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

    // Calculate dynamic seat statistics based on actual seats in database
    const totalSeats = validUsers.length;
    // A seat is occupied only if it has both isActive=true AND a name
    const occupiedSeats = validUsers.filter((user) => user.isActive && user.name && user.name.trim() !== "").length;
    const availableSeats = totalSeats - occupiedSeats;

    // Debug logging
    console.log("Seat statistics debug:");
    console.log("Total valid users:", totalSeats);
    console.log("Users with isActive=true:", validUsers.filter(u => u.isActive).length);
    console.log("Users with names:", validUsers.filter(u => u.name && u.name.trim() !== "").length);
    console.log("Users with isActive=true AND names:", occupiedSeats);

    // Calculate section-wise dynamic statistics
    const sectionAUsers = validUsers.filter(
      (user) => user.seatNumber && user.seatNumber.startsWith("A")
    );
    const sectionBUsers = validUsers.filter(
      (user) => user.seatNumber && user.seatNumber.startsWith("B")
    );

    const sectionATotal = sectionAUsers.length;
    const sectionAOccupied = sectionAUsers.filter(
      (user) => user.isActive && user.name && user.name.trim() !== ""
    ).length;
    const sectionBTotal = sectionBUsers.length;
    const sectionBOccupied = sectionBUsers.filter(
      (user) => user.isActive && user.name && user.name.trim() !== ""
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
        studentName: (user.name && user.name.trim() !== "") ? user.name : "Available",
        plan: user.subscriptionPlan ? user.subscriptionPlan.planName : "-",
        joiningDate: user.joiningDate
          ? user.joiningDate.toISOString().split("T")[0]
          : "-",
        expirationDate: expirationDate || "-",
        status: (user.isActive && user.name && user.name.trim() !== "") ? "Occupied" : "Available",
        feePaid: user.feePaid || false,
        students: (user.isActive && user.name && user.name.trim() !== "")
          ? [
              {
                name: user.name,
                plan: user.subscriptionPlan
                  ? user.subscriptionPlan.planName
                  : null,
                joiningDate: user.joiningDate
                  ? user.joiningDate.toISOString().split("T")[0]
                  : null,
                expiryDate: user.expiryDate
                  ? user.expiryDate.toISOString().split("T")[0]
                  : expirationDate,
                feePaid: user.feePaid,
                slot: user.slot,
                fatherName: user.fatherName,
                dateOfBirth: user.dateOfBirth
                  ? user.dateOfBirth.toISOString().split("T")[0]
                  : null,
              },
            ]
          : [],
      };
    });

    res.json({
      statistics: {
        totalSeats,
        occupiedSeats,
        availableSeats,
        sectionA: {
          total: sectionATotal,
          occupied: sectionAOccupied,
          available: sectionATotal - sectionAOccupied,
        },
        sectionB: {
          total: sectionBTotal,
          occupied: sectionBOccupied,
          available: sectionBTotal - sectionBOccupied,
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
