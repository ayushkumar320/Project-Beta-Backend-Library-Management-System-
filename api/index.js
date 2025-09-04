import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import router from "../routes/admin.route.js";
import connectDB from "../db/connectDB.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Connect to MongoDB before handling requests
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    console.error("Database connection error:", error);
    res.status(500).json({message: "Database connection failed"});
  }
});

app.use("/api/admin", router);

app.get("/", (req, res) => {
  res.send("Server is healthy!");
});

app.get("/api", (req, res) => {
  res.send("API is working!");
});

export default app;
