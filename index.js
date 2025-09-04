import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import router from "./routes/admin.route.js";
import connectDB from "./db/connectDB.js";

const app = express();

dotenv.config();

// Connect to MongoDB
connectDB();

app.use(cors());
app.use(express.json());
app.use("/api/admin", router);

app.get("/", (req, res) => {
  res.send("Server is healthy!");
});

// For local development
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

// Export for Vercel
export default app;
