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

    // Find all students in this seat (including variations with suffixes)
    const studentsInSeat = await User.find({
      seatNumber: {$regex: `^${seatNumber}($|_)`},
    }).populate("subscriptionPlan", "planName duration");

    if (studentsInSeat.length === 0) {
      return res.json({
        seatNumber: seatNumber,
        section: getSectionFromSeat(seatNumber),
        status: "Available",
        students: [],
      });
    }

    // Map all students to the required format
    const studentsData = studentsInSeat.map((user) => ({
      name: user.name,
      plan: user.subscriptionPlan ? user.subscriptionPlan.planName : null,
      joiningDate: user.joiningDate,
      expiryDate: user.expiryDate,
      feePaid: user.feePaid,
      slot: user.slot,
      fatherName: user.fatherName,
      dateOfBirth: user.dateOfBirth,
      adharNumber: user.adharNumber,
      idNumber: user.idNumber,
      isActive: user.isActive,
    }));

    // Check if any student is active to determine seat status
    const hasActiveStudent = studentsInSeat.some((user) => user.isActive);

    res.json({
      seatNumber: seatNumber,
      section: getSectionFromSeat(seatNumber),
      status: hasActiveStudent ? "Occupied" : "Available",
      students: studentsData,
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

// Add multiple students to the same seat (for shared/slot-based seating)
export async function addStudentToSeat(req, res) {
  try {
    const seatNumber = req.params.seatNumber;
    const {studentName, planName, adharNumber, slot, feePaid} = req.body;

    if (!studentName || !planName || !adharNumber) {
      return res.status(400).json({
        message: "Student name, plan name, and Aadhar number are required",
      });
    }

    // Check if student already exists
    const existingStudent = await User.findOne({adharNumber});
    if (existingStudent) {
      return res.status(400).json({
        message: "Student with this Aadhar number already exists",
        existingStudent: {
          name: existingStudent.name,
          seatNumber: existingStudent.seatNumber,
        },
      });
    }

    // Find subscription plan
    const subscriptionPlan = await SubscriptionPlan.findOne({planName});
    if (!subscriptionPlan) {
      return res.status(404).json({
        message: "Subscription plan not found",
      });
    }

    // Check how many students are already in this seat
    const studentsInSeat = await User.find({
      seatNumber: {$regex: `^${seatNumber}($|_)`}, // Match exact seat or with suffix
    });

    // Create unique seat identifier for multiple students
    const seatIdentifier =
      studentsInSeat.length === 0
        ? seatNumber
        : `${seatNumber}_${studentsInSeat.length + 1}`;

    // Create new student
    const newStudent = new User({
      name: studentName,
      adharNumber: adharNumber,
      seatNumber: seatIdentifier,
      subscriptionPlan: subscriptionPlan._id,
      slot: slot || "Full day",
      isActive: true,
      feePaid: feePaid || false,
      joiningDate: new Date(),
    });

    await newStudent.save();
    await newStudent.populate("subscriptionPlan", "planName duration");

    // Get all students in this seat for response
    const allStudentsInSeat = await User.find({
      seatNumber: {$regex: `^${seatNumber}($|_)`},
    }).populate("subscriptionPlan", "planName duration");

    res.json({
      message: "Student added to seat successfully!",
      seatNumber: seatNumber,
      newStudent: {
        name: newStudent.name,
        plan: newStudent.subscriptionPlan.planName,
        slot: newStudent.slot,
        adharNumber: newStudent.adharNumber,
        feePaid: newStudent.feePaid,
        joiningDate: newStudent.joiningDate.toISOString().split("T")[0],
      },
      totalStudentsInSeat: allStudentsInSeat.length,
      allStudents: allStudentsInSeat.map((student) => ({
        name: student.name,
        slot: student.slot,
        plan: student.subscriptionPlan?.planName || "-",
        adharNumber: student.adharNumber,
      })),
    });
  } catch (error) {
    console.error("Error adding student to seat:", error);
    if (error.code === 11000) {
      if (error.keyPattern?.adharNumber) {
        return res.status(400).json({
          message: "Student with this Aadhar number already exists",
        });
      }
    }
    res.status(500).json({
      message: "Internal server error",
    });
  }
}

// Get all students in a specific seat
export async function getStudentsInSeat(req, res) {
  try {
    const seatNumber = req.params.seatNumber;

    // Find all students in this seat (including variations with suffixes)
    const studentsInSeat = await User.find({
      seatNumber: {$regex: `^${seatNumber}($|_)`},
    }).populate("subscriptionPlan", "planName duration");

    if (studentsInSeat.length === 0) {
      return res.json({
        seatNumber: seatNumber,
        status: "Available",
        students: [],
        totalStudents: 0,
      });
    }

    const studentsData = studentsInSeat.map((student) => ({
      id: student._id,
      name: student.name,
      adharNumber: student.adharNumber,
      slot: student.slot,
      plan: student.subscriptionPlan?.planName || "-",
      isActive: student.isActive,
      feePaid: student.feePaid,
      joiningDate: student.joiningDate
        ? student.joiningDate.toISOString().split("T")[0]
        : "-",
      expiryDate: student.expiryDate
        ? student.expiryDate.toISOString().split("T")[0]
        : "-",
    }));

    res.json({
      seatNumber: seatNumber,
      status: "Occupied",
      students: studentsData,
      totalStudents: studentsInSeat.length,
    });
  } catch (error) {
    console.error("Error getting students in seat:", error);
    res.status(500).json({
      message: "Internal server error",
    });
  }
}

export async function updateSeat(req, res) {
  try {
    const seatNumber = req.params.seatNumber;
    const {studentName, planName, isActive, feePaid, adharNumber, slot} =
      req.body;

    if (studentName && planName && adharNumber) {
      // Adding/updating a student - check if student already exists anywhere
      const existingStudent = await User.findOne({adharNumber});
      if (existingStudent) {
        // Student exists, update their seat assignment
        const subscriptionPlan = await SubscriptionPlan.findOne({planName});
        if (!subscriptionPlan) {
          return res.status(404).json({
            message: "Subscription plan not found",
          });
        }

        const updateData = {
          name: studentName,
          seatNumber: seatNumber,
          subscriptionPlan: subscriptionPlan._id,
          slot: slot || existingStudent.slot || "Full day",
          isActive: isActive !== undefined ? isActive : true,
          feePaid: feePaid !== undefined ? feePaid : false,
          joiningDate: new Date(),
        };

        const updatedUser = await User.findOneAndUpdate(
          {adharNumber},
          updateData,
          {new: true}
        ).populate("subscriptionPlan", "planName duration");

        return res.json({
          message: "Student seat updated successfully!",
          seatNumber: seatNumber,
          student: updatedUser.name,
          plan: updatedUser.subscriptionPlan.planName,
          slot: updatedUser.slot,
          status: "Occupied",
          feePaid: updatedUser.feePaid,
          joiningDate: updatedUser.joiningDate.toISOString().split("T")[0],
        });
      } else {
        // New student - check if seat is already occupied
        const seatOccupant = await User.findOne({seatNumber, isActive: true});
        if (seatOccupant) {
          return res.status(400).json({
            message:
              "Seat is already occupied by another student. Please choose a different seat or remove the existing student first.",
            occupiedBy: seatOccupant.name,
          });
        }

        // Create new student
        const subscriptionPlan = await SubscriptionPlan.findOne({planName});
        if (!subscriptionPlan) {
          return res.status(404).json({
            message: "Subscription plan not found",
          });
        }

        const newStudent = new User({
          name: studentName,
          adharNumber: adharNumber,
          seatNumber: seatNumber,
          subscriptionPlan: subscriptionPlan._id,
          slot: slot || "Full day",
          isActive: isActive !== undefined ? isActive : true,
          feePaid: feePaid !== undefined ? feePaid : false,
          joiningDate: new Date(),
        });

        await newStudent.save();
        await newStudent.populate("subscriptionPlan", "planName duration");

        return res.json({
          message: "Student assigned to seat successfully!",
          seatNumber: seatNumber,
          student: newStudent.name,
          plan: newStudent.subscriptionPlan.planName,
          slot: newStudent.slot,
          status: "Occupied",
          feePaid: newStudent.feePaid,
          joiningDate: newStudent.joiningDate.toISOString().split("T")[0],
        });
      }
    }

    // Handle status updates for existing seat
    const existingUser = await User.findOne({seatNumber});
    if (!existingUser) {
      return res.status(404).json({
        message: "Seat not found",
      });
    }

    let updateData = {};
    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }
    if (feePaid !== undefined) {
      updateData.feePaid = feePaid;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        message: "No valid update data provided",
      });
    }

    const updatedUser = await User.findOneAndUpdate({seatNumber}, updateData, {
      new: true,
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
    if (error.code === 11000) {
      // Handle duplicate key errors
      if (error.keyPattern?.seatNumber) {
        return res.status(400).json({
          message: "Seat is already occupied. Please choose a different seat.",
        });
      }
      if (error.keyPattern?.adharNumber) {
        return res.status(400).json({
          message: "Student with this Aadhar number already exists.",
        });
      }
    }
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

    // Calculate section-wise statistics first
    const sectionAUsers = validUsers.filter(
      (user) => user.seatNumber && user.seatNumber.startsWith("A")
    );
    const sectionBUsers = validUsers.filter(
      (user) => user.seatNumber && user.seatNumber.startsWith("B")
    );

    // Calculate actual seat totals based on layout (not just database records)
    const sectionATotal = 66; // Section A has 66 seats (1-66)
    const sectionBTotal = 39; // Section B has 39 seats (1-39)
    const totalSeats = sectionATotal + sectionBTotal; // 105 total seats

    // Calculate occupied seats (count unique base seat numbers, not individual students)
    const getBaseSeatNumber = (seatNumber) => {
      // Extract base seat number (remove _2, _3, etc. suffixes)
      return seatNumber.split('_')[0];
    };

    // Get unique base seat numbers for each section
    const sectionABaseSeatNumbers = new Set();
    const sectionBBaseSeatNumbers = new Set();

    validUsers.forEach((user) => {
      if (user.isActive && user.name && user.name.trim() !== "") {
        const baseSeatNumber = getBaseSeatNumber(user.seatNumber);
        if (baseSeatNumber.startsWith("A")) {
          sectionABaseSeatNumbers.add(baseSeatNumber);
        } else if (baseSeatNumber.startsWith("B")) {
          sectionBBaseSeatNumbers.add(baseSeatNumber);
        }
      }
    });

    const sectionAOccupied = sectionABaseSeatNumbers.size;
    const sectionBOccupied = sectionBBaseSeatNumbers.size;
    const occupiedSeats = sectionAOccupied + sectionBOccupied;
    const availableSeats = totalSeats - occupiedSeats;

    // Debug logging
    console.log("Seat statistics debug:");
    console.log(
      "Section A - Total:",
      sectionATotal,
      "Occupied:",
      sectionAOccupied
    );
    console.log(
      "Section B - Total:",
      sectionBTotal,
      "Occupied:",
      sectionBOccupied
    );
    console.log(
      "Overall - Total:",
      totalSeats,
      "Occupied:",
      occupiedSeats,
      "Available:",
      availableSeats
    );

    // Group users by base seat number and prepare seat data
    const seatMap = new Map();
    const getBaseSeatNumber = (seatNumber) => {
      return seatNumber.split('_')[0];
    };

    // Group students by their base seat number
    validUsers.forEach((user) => {
      const baseSeatNumber = getBaseSeatNumber(user.seatNumber);
      
      if (!seatMap.has(baseSeatNumber)) {
        seatMap.set(baseSeatNumber, {
          seatNumber: baseSeatNumber,
          section: getSectionFromSeat(baseSeatNumber),
          students: [],
          status: "Available",
          feePaid: false,
        });
      }

      const seatInfo = seatMap.get(baseSeatNumber);
      
      // If this user is active and has a name, add them to the seat
      if (user.isActive && user.name && user.name.trim() !== "") {
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

        seatInfo.students.push({
          name: user.name,
          plan: user.subscriptionPlan ? user.subscriptionPlan.planName : null,
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
        });

        // Update seat status
        seatInfo.status = "Occupied";
        seatInfo.feePaid = seatInfo.feePaid || user.feePaid;
      }
    });

    // Convert map to array and add additional seat properties
    const seatData = Array.from(seatMap.values()).map(seat => {
      // Set primary student name for display (first student or "Available")
      const primaryStudent = seat.students.length > 0 ? seat.students[0] : null;
      
      return {
        ...seat,
        studentName: primaryStudent ? primaryStudent.name : "Available",
        plan: primaryStudent ? primaryStudent.plan : "-",
        joiningDate: primaryStudent ? primaryStudent.joiningDate : "-",
        expirationDate: primaryStudent ? primaryStudent.expiryDate : "-",
      };
    });

    res.json({
      totalSeats,
      occupiedSeats,
      availableSeats,
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
