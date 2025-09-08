import jwt from "jsonwebtoken";
import Admin from "../models/admin.model.js";

const adminAuth = async (req, res, next) => {
  try {
    let raw = req.header("Authorization") || req.header("authorization") || "";
    if (!raw && req.header("x-auth-token")) raw = "Bearer " + req.header("x-auth-token");
    if (!/^Bearer\s+\S+/.test(raw))
      return res.status(401).json({message: "Authorization header malformed"});

    const token = raw.split(/\s+/)[1];
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (e) {
      return res
        .status(401)
        .json({message: e.name === "TokenExpiredError" ? "Token expired" : "Invalid token"});
    }

    const admin = await Admin.findById(decoded._id);
    if (!admin) return res.status(401).json({message: "Admin not found"});

    req.admin = admin;
    req.token = token;
    next();
  } catch {
    res.status(401).json({message: "Please authenticate"});
  }
};

export default adminAuth;