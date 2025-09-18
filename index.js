import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import router from "./routes/admin.route.js";
import connectDB from "./db/connectDB.js";

// Configure environment variables
dotenv.config();

connectDB();
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/admin", router);

app.get("/", (req, res) => {
  res.json({message: "Server is healthy!"});
});

app.get("/health", (req, res) => {
  res.json({status: "OK", timestamp: new Date().toISOString()});
});

// Initialize database connection

// For local development only
const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

// Export for serverless
export default app;
