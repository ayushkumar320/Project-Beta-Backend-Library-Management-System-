import User from "../models/user.model.js";
import SubscriptionPlan from "../models/subscriptionPlan.model.js";

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

// For seat management - GET request
export async function getSeatManagement(req, res) {
  try {
    // Get all users with their subscription plans populated
    const users = await User.find()
      .populate("subscriptionPlan", "planName duration")
      .sort({seatNumber: 1})
      .exec();

    // Calculate seat statistics
    const totalSeats = 104; // You can make this dynamic based on your setup
    const occupiedSeats = await User.countDocuments({isActive: true});
    const availableSeats = totalSeats - occupiedSeats;
    const maintenanceSeats = 0; // You can add a maintenance field to User schema if needed

    // Prepare seat allocations data
    const seatAllocations = users.map((user) => {
      let expirationDate = null;
      let status = user.isActive ? "Occupied" : "Available";

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

        expirationDate = expDate.toISOString().split("T")[0]; // YYYY-MM-DD format
      }

      return {
        seatNo: user.seatNumber,
        student: user.isActive ? user.name : "-",
        plan:
          user.isActive && user.subscriptionPlan
            ? user.subscriptionPlan.planName
            : "-",
        allocatedDate: user.isActive
          ? user.joiningDate.toISOString().split("T")[0]
          : "-",
        expires: expirationDate || "-",
        status: status,
        userId: user._id,
        feePaid: user.feePaid,
      };
    });

    // Create seat layout data (for visual representation)
    const seatLayout = [];
    for (let i = 1; i <= totalSeats; i++) {
      const seatNumber = i.toString().padStart(3, "0"); // Format as 001, 002, etc.
      const user = users.find((u) => u.seatNumber === seatNumber);

      seatLayout.push({
        seatNumber: seatNumber,
        status: user && user.isActive ? "Occupied" : "Available",
        studentName: user && user.isActive ? user.name : null,
      });
    }

    res.json({
      statistics: {
        totalSeats,
        occupied: occupiedSeats,
        available: availableSeats,
        maintenance: maintenanceSeats,
      },
      seatLayout,
      seatAllocations,
      pagination: {
        currentPage: 1,
        totalPages: Math.ceil(seatAllocations.length / 10),
        showing: `1 to ${Math.min(10, seatAllocations.length)} of ${
          seatAllocations.length
        } seats`,
      },
    });
  } catch (error) {
    console.error("Error fetching seat management data:", error);
    res.status(500).json({message: "Internal server error"});
  }
}
