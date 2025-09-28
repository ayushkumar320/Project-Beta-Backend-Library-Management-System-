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
    // Check if Section A already has seats
    const existingASeats = await User.find({
      seatNumber: {$regex: /^A\d+$/},
    }).countDocuments();

    if (existingASeats === 0) {
      // Initialize Section A with 66 default seats (all available)
      const defaultSeatsA = [];
      for (let i = 1; i <= 66; i++) {
        defaultSeatsA.push({
          seatNumber: `A${i}`,
          isActive: false, // Available by default
          joiningDate: new Date(),
          // Don't set name for empty seats - will show as "Available"
        });
      }

      await User.insertMany(defaultSeatsA);
      console.log("Initialized Section A with 66 default seats");
    }

    // Check if Section B already has seats
    const existingBSeats = await User.find({
      seatNumber: {$regex: /^B\d+$/},
    }).countDocuments();

    if (existingBSeats === 0) {
      // Initialize Section B with 39 default seats (all available)
      const defaultSeatsB = [];
      for (let i = 1; i <= 39; i++) {
        defaultSeatsB.push({
          seatNumber: `B${i}`,
          isActive: false, // Available by default
          joiningDate: new Date(),
          // Don't set name for empty seats - will show as "Available"
        });
      }

      await User.insertMany(defaultSeatsB);
      console.log("Initialized Section B with 39 default seats");
    }

    res.json({
      message: "Default seats initialized successfully",
      sectionASeats: 66,
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
      // Find max seat number for Section A, default to 66 if no seats exist
      const sectionASeats = allSeats
        .filter((seat) => seat.seatNumber && seat.seatNumber.startsWith("A"))
        .map((seat) => parseInt(seat.seatNumber.substring(1)))
        .filter((num) => !isNaN(num));

      const maxA = sectionASeats.length > 0 ? Math.max(...sectionASeats) : 66; // Default to 66

      // Get available seats in Section A up to the maximum found (minimum 66)
      for (let i = 1; i <= Math.max(maxA, 66); i++) {
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
      adharNumber: user.adharNumber,
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

    // Check if any user already has this seat number
    const existingSeatUser = await User.findOne({seatNumber});

    if (existingSeatUser) {
      // If seat exists and is occupied (has active student), prevent adding
      if (
        existingSeatUser.isActive &&
        existingSeatUser.name &&
        existingSeatUser.name.trim() !== ""
      ) {
        return res.status(400).json({
          message: `Seat ${seatNumber} is already occupied by ${existingSeatUser.name}`,
          occupied: true,
          studentName: existingSeatUser.name,
        });
      } else {
        // Seat exists but is available - just return success
        return res.json({
          message: `Seat ${seatNumber} is already available!`,
          seatNumber: seatNumber,
          section: getSectionFromSeat(seatNumber),
          student: "Available",
          plan: "-",
          status: "Available",
          feePaid: false,
          alreadyExists: true,
        });
      }
    }

    // Create a new seat record (inactive/available by default) - only for seats that don't exist at all
    const newSeat = new User({
      seatNumber: seatNumber,
      isActive: false, // Available by default
      joiningDate: new Date(),
      feePaid: false,
      // Don't set name, adharNumber, or subscriptionPlan for empty seats
    });

    await newSeat.save();

    res.json({
      message: "Seat added successfully!",
      seatNumber: seatNumber,
      section: getSectionFromSeat(seatNumber),
      student: "Available",
      plan: "-",
      status: "Available",
      feePaid: false,
    });
  } catch (error) {
    console.error("Error adding seat:", error);
    if (error.code === 11000) {
      return res.status(400).json({
        message: "Seat number already exists",
      });
    }
    res.status(500).json({
      message: "Internal server error",
      error: error.message,
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

    // Actually delete the seat record from the database
    const deletedSeat = await User.deleteOne({seatNumber});

    if (deletedSeat.deletedCount === 0) {
      return res.status(404).json({
        message: `Seat ${seatNumber} not found in database`,
      });
    }

    res.json({
      message: "Seat deleted successfully!",
      seatNumber: seatNumber,
      deletedCount: deletedSeat.deletedCount,
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

    console.log("UpdateSeat called with:", {
      seatNumber,
      studentName,
      planName,
      isActive,
      feePaid,
      adharNumber,
      slot,
    });

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

    console.log(`Found ${users.length} total user records in database`);

    // Filter out users with invalid seat numbers (for data consistency)
    const validUsers = users.filter((user) =>
      validateSeatNumber(user.seatNumber)
    );

    console.log(
      `Found ${validUsers.length} valid user records with proper seat numbers`
    );

    // Calculate dynamic seat totals based on what actually exists in database
    // Find the highest seat numbers for each section
    let sectionATotal = 66; // Default minimum
    let sectionBTotal = 39; // Default minimum

    // Check database for highest seat numbers to support expandable seating
    const sectionASeats = validUsers.filter((user) =>
      user.seatNumber.startsWith("A")
    );
    const sectionBSeats = validUsers.filter((user) =>
      user.seatNumber.startsWith("B")
    );

    if (sectionASeats.length > 0) {
      const maxASeat = Math.max(
        ...sectionASeats.map((user) => {
          const match = user.seatNumber.match(/^A(\d+)/);
          return match ? parseInt(match[1]) : 0;
        })
      );
      sectionATotal = Math.max(sectionATotal, maxASeat);
    }

    if (sectionBSeats.length > 0) {
      const maxBSeat = Math.max(
        ...sectionBSeats.map((user) => {
          const match = user.seatNumber.match(/^B(\d+)/);
          return match ? parseInt(match[1]) : 0;
        })
      );
      sectionBTotal = Math.max(sectionBTotal, maxBSeat);
    }

    const totalSeats = sectionATotal + sectionBTotal;

    // Calculate occupied seats (count unique base seat numbers, not individual students)
    const getBaseSeatNumber = (seatNumber) => {
      // Extract base seat number (remove _2, _3, etc. suffixes)
      return seatNumber.split("_")[0];
    };

    // Create a map of all occupied seats
    const occupiedSeats = new Map();
    const sectionAOccupiedSet = new Set();
    const sectionBOccupiedSet = new Set();

    validUsers.forEach((user) => {
      if (user.isActive && user.name && user.name.trim() !== "") {
        const baseSeatNumber = getBaseSeatNumber(user.seatNumber);

        if (!occupiedSeats.has(baseSeatNumber)) {
          occupiedSeats.set(baseSeatNumber, {
            students: [],
            status: "Occupied",
            feePaid: false,
          });
        }

        const seatInfo = occupiedSeats.get(baseSeatNumber);

        // Calculate expiration date
        let expirationDate = null;
        if (user.subscriptionPlan && user.joiningDate) {
          const joiningDate = new Date(user.joiningDate);
          const planDuration = user.subscriptionPlan.duration;
          const durationLower = planDuration.toLowerCase();

          let expDate = new Date(joiningDate);

          if (durationLower.includes("day")) {
            const days = parseInt(planDuration.match(/\d+/)?.[0] || "30");
            expDate.setDate(joiningDate.getDate() + days);
          } else if (durationLower.includes("week")) {
            const weeks = parseInt(planDuration.match(/\d+/)?.[0] || "4");
            expDate.setDate(joiningDate.getDate() + weeks * 7);
          } else if (durationLower.includes("month")) {
            const months = parseInt(planDuration.match(/\d+/)?.[0] || "1");
            expDate.setMonth(joiningDate.getMonth() + months);
          } else if (durationLower.includes("year")) {
            const years = parseInt(planDuration.match(/\d+/)?.[0] || "1");
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
          adharNumber: user.adharNumber,
        });

        // Update seat status
        seatInfo.feePaid = seatInfo.feePaid || user.feePaid;

        // Track occupied seats per section
        if (baseSeatNumber.startsWith("A")) {
          sectionAOccupiedSet.add(baseSeatNumber);
        } else if (baseSeatNumber.startsWith("B")) {
          sectionBOccupiedSet.add(baseSeatNumber);
        }
      }
    });

    // Calculate final statistics
    const sectionAOccupied = sectionAOccupiedSet.size;
    const sectionBOccupied = sectionBOccupiedSet.size;
    const totalOccupied = sectionAOccupied + sectionBOccupied;
    const availableSeats = totalSeats - totalOccupied;

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
      totalOccupied,
      "Available:",
      availableSeats
    );

    // Generate seat data based on ACTUAL database records PLUS minimum base seats
    const seatData = [];

    // Create sets of all existing seat numbers from database
    const existingSeats = new Set(validUsers.map((user) => user.seatNumber));

    // Calculate minimum base seats and actual max seats
    const minSectionASeats = 66; // Minimum base for Section A
    const minSectionBSeats = 39; // Minimum base for Section B

    // Get actual maximum seat numbers from database
    let actualMaxA = minSectionASeats;
    let actualMaxB = minSectionBSeats;

    sectionASeats.forEach((user) => {
      const match = user.seatNumber.match(/^A(\d+)/);
      if (match) {
        actualMaxA = Math.max(actualMaxA, parseInt(match[1]));
      }
    });

    sectionBSeats.forEach((user) => {
      const match = user.seatNumber.match(/^B(\d+)/);
      if (match) {
        actualMaxB = Math.max(actualMaxB, parseInt(match[1]));
      }
    });

    // Generate complete seat grids (minimum base + any expanded seats)
    // Section A seats
    for (let i = 1; i <= actualMaxA; i++) {
      const seatNumber = `A${i}`;
      const occupiedInfo = occupiedSeats.get(seatNumber);

      if (occupiedInfo) {
        // Occupied seat
        const primaryStudent = occupiedInfo.students[0];
        seatData.push({
          seatNumber,
          section: "A",
          students: occupiedInfo.students,
          status: "Occupied",
          feePaid: occupiedInfo.feePaid,
          studentName: primaryStudent.name,
          plan: primaryStudent.plan || "-",
          joiningDate: primaryStudent.joiningDate || "-",
          expirationDate: primaryStudent.expiryDate || "-",
          studentCount: occupiedInfo.students.length,
        });
      } else {
        // Available seat (show as available whether it exists in DB or not)
        seatData.push({
          seatNumber,
          section: "A",
          students: [],
          status: "Available",
          feePaid: false,
          studentName: "Available",
          plan: "-",
          joiningDate: "-",
          expirationDate: "-",
          studentCount: 0,
        });
      }
    }

    // Section B seats
    for (let i = 1; i <= actualMaxB; i++) {
      const seatNumber = `B${i}`;
      const occupiedInfo = occupiedSeats.get(seatNumber);

      if (occupiedInfo) {
        // Occupied seat
        const primaryStudent = occupiedInfo.students[0];
        seatData.push({
          seatNumber,
          section: "B",
          students: occupiedInfo.students,
          status: "Occupied",
          feePaid: occupiedInfo.feePaid,
          studentName: primaryStudent.name,
          plan: primaryStudent.plan || "-",
          joiningDate: primaryStudent.joiningDate || "-",
          expirationDate: primaryStudent.expiryDate || "-",
          studentCount: occupiedInfo.students.length,
        });
      } else {
        // Available seat (show as available whether it exists in DB or not)
        seatData.push({
          seatNumber,
          section: "B",
          students: [],
          status: "Available",
          feePaid: false,
          studentName: "Available",
          plan: "-",
          joiningDate: "-",
          expirationDate: "-",
          studentCount: 0,
        });
      }
    }

    // Remove duplicates (in case of multiple students per seat)
    const uniqueSeats = new Map();
    seatData.forEach((seat) => {
      if (!uniqueSeats.has(seat.seatNumber)) {
        uniqueSeats.set(seat.seatNumber, seat);
      }
    });

    const finalSeatData = Array.from(uniqueSeats.values());

    // Sort seats properly (A1, A2... A10, A11... then B1, B2... etc.)
    finalSeatData.sort((a, b) => {
      const aSection = a.seatNumber.charAt(0);
      const bSection = b.seatNumber.charAt(0);

      if (aSection !== bSection) {
        return aSection.localeCompare(bSection);
      }

      const aNum = parseInt(a.seatNumber.slice(1));
      const bNum = parseInt(b.seatNumber.slice(1));
      return aNum - bNum;
    });

    // Update totals based on actual seat data
    const actualSectionASeats = finalSeatData.filter(
      (seat) => seat.section === "A"
    ).length;
    const actualSectionBSeats = finalSeatData.filter(
      (seat) => seat.section === "B"
    ).length;
    const actualTotalSeats = actualSectionASeats + actualSectionBSeats;

    console.log(
      `Generated ${finalSeatData.length} total seats (${actualSectionASeats} Section A + ${actualSectionBSeats} Section B)`
    );

    // Debug: Log the actual counts
    console.log("Count Debug:");
    console.log("Final seat data length:", finalSeatData.length);
    console.log("Occupied seats count:", totalOccupied);
    console.log("Available calculation:", actualTotalSeats - totalOccupied);
    console.log("Section A seats:", actualSectionASeats);
    console.log("Section B seats:", actualSectionBSeats);
    console.log(
      "Sample seats:",
      finalSeatData.slice(0, 5).map((s) => s.seatNumber)
    );

    // Prepare response with actual seat data
    const response = {
      totalSeats: actualTotalSeats,
      occupiedSeats: totalOccupied,
      availableSeats: actualTotalSeats - totalOccupied,
      statistics: {
        totalSeats: actualTotalSeats,
        occupiedSeats: totalOccupied,
        availableSeats: actualTotalSeats - totalOccupied,
        sectionA: {
          total: actualSectionASeats,
          occupied: sectionAOccupied,
          available: actualSectionASeats - sectionAOccupied,
        },
        sectionB: {
          total: actualSectionBSeats,
          occupied: sectionBOccupied,
          available: actualSectionBSeats - sectionBOccupied,
        },
      },
      seats: finalSeatData,
      invalidSeats: users
        .filter((user) => !validateSeatNumber(user.seatNumber))
        .map((user) => ({
          seatNumber: user.seatNumber,
          studentName: user.name || "Unknown",
          reason: "Invalid seat number format",
        })),
    };

    res.json(response);
  } catch (error) {
    console.error("Error fetching seat management data:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message,
      // Fallback data structure for frontend
      totalSeats: 105,
      occupiedSeats: 0,
      availableSeats: 105,
      seats: [],
    });
  }
}

// Function to clean up invalid seat numbers and orphaned records (admin use)
export async function cleanupInvalidSeats(req, res) {
  try {
    const {action = "check"} = req.query; // 'check' or 'cleanup'

    // Find all users
    const allUsers = await User.find();
    console.log(`Found ${allUsers.length} total user records`);

    // Find users with invalid seat numbers
    const invalidUsers = allUsers.filter(
      (user) => !validateSeatNumber(user.seatNumber)
    );

    // Find duplicate seat numbers (excluding multi-student seats with _2, _3 suffixes)
    const seatNumbers = new Map();
    const duplicateUsers = [];

    allUsers.forEach((user) => {
      const baseSeat = user.seatNumber.split("_")[0];
      if (seatNumbers.has(baseSeat)) {
        // Only flag as duplicate if both records have the same suffix or both have no suffix
        const existing = seatNumbers.get(baseSeat);
        if (user.seatNumber === existing.seatNumber) {
          duplicateUsers.push(user);
        }
      } else {
        seatNumbers.set(baseSeat, user);
      }
    });

    // Find orphaned empty seats (seats with no name and not active)
    const orphanedEmptySeats = allUsers.filter(
      (user) =>
        !user.name &&
        !user.isActive &&
        user.seatNumber &&
        validateSeatNumber(user.seatNumber)
    );

    const problemRecords = {
      invalid: invalidUsers,
      duplicates: duplicateUsers,
      orphanedEmpty: orphanedEmptySeats,
    };

    if (action === "cleanup") {
      let cleanedCount = 0;

      // Remove invalid seats
      if (invalidUsers.length > 0) {
        await User.deleteMany({
          _id: {$in: invalidUsers.map((u) => u._id)},
        });
        cleanedCount += invalidUsers.length;
        console.log(`Removed ${invalidUsers.length} invalid seat records`);
      }

      // Remove exact duplicates (keep the first one)
      if (duplicateUsers.length > 0) {
        await User.deleteMany({
          _id: {$in: duplicateUsers.map((u) => u._id)},
        });
        cleanedCount += duplicateUsers.length;
        console.log(`Removed ${duplicateUsers.length} duplicate seat records`);
      }

      return res.json({
        message: `Database cleanup completed - removed ${cleanedCount} problematic records`,
        cleaned: {
          invalidSeats: invalidUsers.length,
          duplicates: duplicateUsers.length,
          orphanedEmpty: orphanedEmptySeats.length,
        },
        suggestion:
          "Please refresh the seat management page to see updated data",
      });
    }

    // Check mode - just return the problems found
    const totalProblems = invalidUsers.length + duplicateUsers.length;

    if (totalProblems === 0) {
      return res.json({
        message: "Database is clean - no problematic seat records found",
        stats: {
          totalRecords: allUsers.length,
          orphanedEmptySeats: orphanedEmptySeats.length,
        },
      });
    }

    res.json({
      message: `Found ${totalProblems} problematic seat record(s)`,
      problems: {
        invalidSeats: invalidUsers.map((user) => ({
          _id: user._id,
          seatNumber: user.seatNumber,
          studentName: user.name || "Empty",
          reason: "Invalid seat number format",
        })),
        duplicates: duplicateUsers.map((user) => ({
          _id: user._id,
          seatNumber: user.seatNumber,
          studentName: user.name || "Empty",
          reason: "Duplicate seat number",
        })),
      },
      stats: {
        totalRecords: allUsers.length,
        orphanedEmptySeats: orphanedEmptySeats.length,
      },
      suggestion:
        "Call this endpoint with ?action=cleanup to remove problematic records",
    });
  } catch (error) {
    console.error("Error in seat cleanup:", error);
    res
      .status(500)
      .json({message: "Internal server error", error: error.message});
  }
}
