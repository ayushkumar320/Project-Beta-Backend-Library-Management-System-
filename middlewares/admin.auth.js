import jwt from "jsonwebtoken";
import Admin from "../models/admin.model.js";
import connectDB from "../db/connectDB.js";

const adminAuth = async (req, res, next) => {
  try {
    // Ensure database connection
    await connectDB();
    const auth = req.header("Authorization") || "";
    const parts = auth.trim().split(/\s+/);
    if (parts.length !== 2 || !/^Bearer$/i.test(parts[0])) {
      return res.status(401).json({message: "Authorization header malformed"});
    }
    const token = parts[1];
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log("Decoded token:", decoded);
    } catch (e) {
      return res
        .status(401)
        .json({
          message:
            e.name === "TokenExpiredError" ? "Token expired" : "Invalid token",
        });
    }
    const admin = await Admin.findById(decoded._id);
    console.log("Found admin:", admin);
    if (!admin) return res.status(401).json({message: "Admin not found"});
    req.token = token;
    req.admin = admin;
    next();
  } catch (err) {
    res.status(401).json({message: "Please authenticate"});
  }
};

export default adminAuth;
