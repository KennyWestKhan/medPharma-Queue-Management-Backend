const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const { Pool } = require("pg");
const path = require("path");

require("dotenv").config({ path: path.join(__dirname, ".env") });

const medPharmaDomain = "https://medPharmaDomain.com";
const origin =
  process.env.NODE_ENV === "production"
    ? [medPharmaDomain]
    : ["http://localhost:3000"];

const {
  DB_HOST = "",
  DB_PORT = 5432,
  DB_USER = "postgres",
  DB_PASSWORD = "",
  DB_NAME = "medp_queue",
  NODE_ENV,
} = process.env;

const queueRoutes = require("./routes/queue");
const doctorRoutes = require("./routes/doctors");
const patientRoutes = require("./routes/patients");
const QueueManager = require("./services/queueManager");
const DatabaseService = require("./services/database");

const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
  cors: {
    origin,
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

const db = new Pool({
  host: DB_HOST,
  port: Number(DB_PORT),
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  ssl: NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

const databaseService = new DatabaseService(db);
const queueManager = new QueueManager(databaseService, io);

// Middleware
app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);

app.use(
  cors({
    origin,
    credentials: true,
  })
);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP, please try again later.",
});
app.use("/api/", limiter);

app.use(morgan("combined"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API Routes
app.use("/api/queue", queueRoutes(queueManager));
app.use("/api/doctors", doctorRoutes(queueManager));
app.use("/api/patients", patientRoutes(queueManager));

io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on("joinPatientRoom", async (data) => {
    const { patientId, doctorId } = data;
    const roomId = `doctor_${doctorId}`;

    await socket.join(roomId);
    socket.userId = patientId;
    socket.userType = "patient";
    socket.doctorId = doctorId;

    console.log(`Patient ${patientId} joined room ${roomId}`);

    try {
      const queueStatus = await queueManager.getPatientQueueStatus(patientId);
      socket.emit("queueUpdate", queueStatus);
    } catch (error) {
      socket.emit("error", { message: error.message });
    }
  });

  socket.on("joinDoctorRoom", async (data) => {
    const { doctorId } = data;
    const roomId = `doctor_${doctorId}`;

    await socket.join(roomId);
    socket.userId = doctorId;
    socket.userType = "doctor";
    socket.doctorId = doctorId;

    console.log(`Doctor ${doctorId} joined room ${roomId}`);

    try {
      const queue = await queueManager.getDoctorQueue(doctorId);
      socket.emit("queueChanged", { queue });
    } catch (error) {
      socket.emit("error", { message: error.message });
    }
  });

  socket.on("updatePatientStatus", async (data) => {
    const { patientId, status } = data;

    try {
      await queueManager.updatePatientStatus(patientId, status);
      console.log(`Updated patient ${patientId} status to ${status}`);
    } catch (error) {
      console.error("Failed to update patient status:", error);
      socket.emit("error", { message: error.message });
    }
  });

  socket.on("updateDoctorAvailability", async (data) => {
    const { doctorId, isAvailable } = data;

    try {
      await queueManager.updateDoctorAvailability(doctorId, isAvailable);
      console.log(`Updated doctor ${doctorId} availability to ${isAvailable}`);
    } catch (error) {
      console.error("Failed to update doctor availability:", error);
      socket.emit("error", { message: error.message });
    }
  });

  socket.on("leaveRoom", async (data) => {
    const { roomId } = data;
    await socket.leave(roomId);
    console.log(`Client ${socket.id} left room ${roomId}`);
  });

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);

  if (err.type === "validation") {
    return res.status(400).json({
      error: "Validation Error",
      message: err.message,
      details: err.details || [],
    });
  }

  if (err.type === "not_found") {
    return res.status(404).json({
      error: "Not Found",
      message: err.message,
    });
  }

  res.status(500).json({
    error: "Internal Server Error",
    message:
      process.env.NODE_ENV === "production"
        ? "Something went wrong!"
        : err.message,
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: `Route ${req.originalUrl} not found`,
  });
});

// Initialize database and start server
async function startServer() {
  try {
    await databaseService.initialize();
    console.log("Database connected and initialized");

    const PORT = process.env.PORT || 3001;
    server.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`Socket.io ready for connections`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  server.close(() => {
    console.log("Process terminated");
    db.end();
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully");
  server.close(() => {
    console.log("Process terminated");
    db.end();
  });
});

startServer();

module.exports = { app, server, io };
