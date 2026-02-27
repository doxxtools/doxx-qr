import express from "express";

const app = express();

// Render provides PORT automatically
const PORT = process.env.PORT || 3000;

// Root route
app.get("/", (req, res) => {
  res.send("DoxxQR backend running 🚀");
});

// Test route
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Server is healthy",
    time: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});