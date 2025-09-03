const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const swaggerUi = require("swagger-ui-express");
const { specs: swaggerSpec } = require("./config/swagger");
const { Pool } = require("pg");
const path = require("path");

require("dotenv").config({ path: path.join(__dirname, ".env") });

const medPharmaDomain = "https://medPharmaDomain.com";
// CORS configuration
const corsConfig =
  process.env.NODE_ENV === "production"
    ? {
        origin: [medPharmaDomain],
        credentials: true,
      }
    : {
        origin: "*", // Allow all origins in development
        credentials: true,
      };

const {
  DB_HOST = "",
  DB_PORT = 5432,
  DB_USER = "postgres",
  DB_PASSWORD = "",
  DB_NAME = "medp_queue",
  NODE_ENV,
} = process.env;

const { createQueueRoutes } = require("./routes/queue");
const doctorRoutes = require("./routes/doctors");
const patientRoutes = require("./routes/patients");
const QueueManager = require("./services/queueManager");
const DatabaseService = require("./services/database");
const {
  getDoctorPatientRoom,
  getDoctorRoom,
  getPatientPrivateRoom,
} = require("./services");

const app = express();

// Trust proxy - required when behind a reverse proxy like nginx, load balancer, or using ngrok
app.set("trust proxy", 1);

const server = http.createServer(app);

const io = socketIo(server, {
  cors: {
    origin: corsConfig.origin,
    methods: ["GET", "POST", "PATCH", "DELETE"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  },
  transports: ["websocket", "polling"],
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Debug socket.io events
io.engine.on("connection_error", (err) => {
  console.log("Connection error:", err);
});

io.engine.on("headers", (headers, req) => {
  console.log("Handshake headers:", headers);
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
app.use(cors(corsConfig));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

// Swagger Documentation UI
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get("/swagger.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);

// const CORS_STRATEGY = process.env.CORS_STRATEGY || "permissive";

// if (CORS_STRATEGY === "strict") {
//   app.use(
//     cors({
//       origin: function (origin, callback) {
//         // Allow requests with no origin (like mobile apps, Postman, local HTML files)
//         if (!origin) {
//           console.info("Request with no origin - allowing");
//           return callback(null, true);
//         }

//         const allowedOrigins = [
//           "http://localhost:3000",
//           "http://localhost:3001",
//           "http://127.0.0.1:3000",
//           "http://127.0.0.1:3001",
//           "exp://192.168.1.100:8081",
//           "file://",
//           "null",
//         ];

//         console.info("Request origin:", origin);

//         // Check if origin matches any allowed pattern
//         const isAllowed = allowedOrigins.some((allowed) => {
//           if (allowed === "file://") {
//             return origin.startsWith("file://");
//           }
//           if (allowed === "null") {
//             return origin === "null";
//           }
//           return origin === allowed || origin.startsWith(allowed);
//         });

//         if (isAllowed) {
//           console.info("Origin allowed:", origin);
//           callback(null, true);
//         } else {
//           console.warn("Origin blocked:", origin);
//           callback(new Error(`Origin ${origin} not allowed by CORS policy`));
//         }
//       },
//       credentials: true,
//       methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
//       allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
//       optionsSuccessStatus: 200,
//     })
//   );
// }
{
  // Permissive CORS for development
  app.use(cors(corsConfig));
  console.info("Using permissive CORS strategy for development");
}

// Ensure preflight requests are handled for all routes
app.options("*", cors(corsConfig));

app.use((err, req, res, next) => {
  if (err && err.message && err.message.toLowerCase().includes("cors")) {
    return res.status(403).json({
      success: false,
      error: "CORS_FORBIDDEN",
      message: err.message,
      origin: req.headers.origin || null,
      timestamp: new Date().toISOString(),
    });
  }
  next(err);
});

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  // use the client's real IP from X-Forwarded-For cos of ngrok proxy
  trustProxy: true,
  max: 100,
  message: "Too many requests from this IP, please try again later.",
});
app.use("/api/", limiter);

app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, { explorer: true })
);
app.get("/swagger.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.use("/api/queue", createQueueRoutes(queueManager));
app.use("/api/doctors", doctorRoutes(queueManager));
app.use("/api/patients", patientRoutes(queueManager));

io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  let currentRooms = new Set();

  function validateUUID(id) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      id
    );
  }

  async function handlePatientUpdate(
    event,
    { patientId, doctorId, status, reason = "" }
  ) {
    try {
      console.log(`Handling ${event} - Socket details:`, {
        socketId: socket.id,
        userType: socket.userType,
        socketDoctorId: socket.doctorId,
        receivedDoctorId: doctorId,
        patientId,
        hasUserType: !!socket.userType,
        isDoctor: socket.userType === "doctor",
      });

      if (socket.userType !== "doctor") {
        console.log("AUTHORIZATION FAILED:", {
          expectedType: "doctor",
          actualType: socket.userType,
        });
        throw new Error("Unauthorized: Only doctors can update patient status");
      }

      if (!patientId || !doctorId) {
        throw new Error("Missing patientId or doctorId");
      }

      const newStatus = event === "startConsultation" ? "consulting" : status;

      await queueManager.updatePatientStatus(patientId, newStatus, reason);

      const doctorPatientRoom = getDoctorPatientRoom(doctorId, patientId);

      if (status === "startConsultation") {
        await queueManager.emitConsultationStarted(doctorId, patientId);
      } else if (status === "completed") {
        await queueManager.emitConsultationCompleted(doctorId, patientId);
      } else {
        io.to(doctorPatientRoom).emit("patientStatusUpdated", {
          patient,
          doctor,
          patientId,
          status: newStatus,
          reason,
        });
      }

      console.log(`${event} handled successfully`);
    } catch (error) {
      console.error(`Error in ${event}:`, error);
      socket.emit("error", {
        message: error.message,
        code: `${event.toUpperCase()}_ERROR`,
      });
    }
  }

  socket.on("startConsultation", (payload) =>
    handlePatientUpdate("startConsultation", payload)
  );

  socket.on("updatePatientStatus", (payload) =>
    handlePatientUpdate("updatePatientStatus", payload)
  );

  socket.on("completeConsultation", async ({ patientId, doctorId }) => {
    try {
      console.log("Completing consultation:", {
        patientId,
        doctorId,
        userType: socket.userType,
        socketId: socket.id,
      });

      if (socket.userType !== "doctor") {
        throw new Error(
          "Unauthorized: Only doctors can complete consultations"
        );
      }

      if (!patientId || !doctorId) {
        throw new Error("Missing patientId or doctorId");
      }

      await queueManager.updatePatientStatus(patientId, "completed");

      const patient = await queueManager.getPatient(patientId);
      const doctor = await queueManager.getDoctor(doctorId);
      const doctorRoom = getDoctorRoom(doctorId);

      // Send update to specific patient's room
      const doctorPatientRoom = `${doctorRoom}:patient:${patientId}`;
      io.to(doctorPatientRoom).emit("consultationCompleted", {
        patient,
        doctor,
      });

      // Update doctor's queue
      const updatedQueue = await queueManager.getDoctorQueue(doctorId);
      io.to(doctorRoom).emit("queueChanged", { queue: updatedQueue });

      console.log("Consultation completed successfully");
    } catch (error) {
      console.error("Error completing consultation:", error);
      socket.emit("error", {
        message: error.message,
        code: "COMPLETE_CONSULTATION_ERROR",
      });
    }
  });

  socket.on(
    "removePatientFromQueue",
    async ({ patientId, doctorId, reason }) => {
      try {
        console.log("=== REMOVE PATIENT REQUEST RECEIVED ===");
        console.log("Request details:", {
          patientId,
          doctorId,
          reason,
          userType: socket.userType,
          socketDoctorId: socket.doctorId,
          socketId: socket.id,
          timestamp: new Date().toISOString(),
        });

        if (socket.userType !== "doctor") {
          console.log("UNAUTHORIZED: userType is not doctor:", socket.userType);
          throw new Error("Unauthorized: Only doctors can remove patients");
        }

        if (!patientId || !doctorId) {
          console.log("MISSING PARAMETERS:", { patientId, doctorId });
          throw new Error("Missing patientId or doctorId");
        }

        console.log("Fetching patient from database...");
        const patient = await queueManager.getPatient(patientId);
        if (!patient) {
          console.log("PATIENT NOT FOUND:", patientId);
          throw new Error("Patient not found");
        }

        console.log("Patient found:", { id: patient.id, name: patient.name });

        console.log("Removing patient from queue...");
        await queueManager.removePatientFromQueue(patientId);
        console.log("Patient successfully removed from database");

        const doctor = await queueManager.getDoctor(doctorId);
        const eventData = { patient, doctor, reason };

        // Notify the specific patient room
        const doctorPatientRoom = `doctor:${doctorId}:patient:${patientId}`;
        const doctorRoom = `doctor:${doctorId}`;

        console.log("Emitting events to rooms:", {
          doctorPatientRoom,
          doctorRoom,
        });

        io.to(doctorPatientRoom).emit("patientRemoved", eventData);

        // Get updated queue and notify doctor's room
        const updatedQueue = await queueManager.getDoctorQueue(doctorId);
        console.log("Updated queue length:", updatedQueue.length);
        io.to(doctorRoom).emit("queueChanged", { queue: updatedQueue });

        // Send success response back to the requesting doctor
        console.log("Sending success response to socket:", socket.id);
        socket.emit("removePatientFromQueueResponse", {
          success: true,
          message: "Patient removed successfully",
          patient,
          timestamp: new Date().toISOString(),
        });

        console.log("=== PATIENT REMOVAL COMPLETED SUCCESSFULLY ===");
      } catch (error) {
        console.error("=== ERROR REMOVING PATIENT ===", error);
        socket.emit("removePatientFromQueueResponse", {
          success: false,
          message: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    }
  );

  // Join patient's room with validation
  socket.on("joinPatientRoom", async (data) => {
    try {
      if (!data || !data?.patientId) {
        throw new Error("Patient ID is required");
      }

      const { patientId } = data;

      if (!validateUUID(patientId)) {
        throw new Error(`Invalid patient ID format: ${patientId}`);
      }

      const patient = await queueManager.getPatient(patientId);

      if (!patient) {
        throw new Error(`Patient ${patientId} not found`);
      }

      const { doctor_id, name: patientName } = patient;

      if (!doctor_id) {
        throw new Error(
          `Patient ${patientName} with ID ${patientId} is not assigned to a doctor`
        );
      }

      // Create unique rooms for patient and doctor-patient communication
      const patientPrivateRoom = getPatientPrivateRoom(patientId);
      const doctorPatientRoom = getDoctorPatientRoom(doctor_id, patientId);

      // Join both rooms
      await socket.join(patientPrivateRoom);
      await socket.join(doctorPatientRoom);
      currentRooms.add(patientPrivateRoom);
      currentRooms.add(doctorPatientRoom);

      socket.userId = patientId;
      socket.userType = "patient";
      socket.doctorId = doctor_id;
      socket.privateRoom = patientPrivateRoom;
      socket.doctorPatientRoom = doctorPatientRoom;

      console.log(
        `Patient ${patientId} joined rooms: ${patientPrivateRoom}, ${doctorPatientRoom}`
      );

      const queueStatus = await queueManager.getPatientQueueStatus(patientId);

      socket.emit("queueUpdate", queueStatus);
    } catch (error) {
      console.error("Error in joinPatientRoom:", error);
      socket.emit("error", {
        message: error.message,
        code: error.code || "JOIN_ROOM_ERROR",
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Join doctor's room with validation
  socket.on("joinDoctorRoom", async (data) => {
    try {
      console.log("=== JOIN DOCTOR ROOM REQUEST ===");
      const { doctorId } = data;
      console.log("Doctor ID:", doctorId);

      if (!doctorId) {
        throw new Error("Doctor ID is required");
      }

      // Create doctor's private room
      const doctorPrivateRoom = `doctor:${doctorId}`;
      await socket.join(doctorPrivateRoom);
      currentRooms.add(doctorPrivateRoom);

      socket.userId = doctorId;
      socket.userType = "doctor";
      socket.doctorId = doctorId;
      socket.privateRoom = doctorPrivateRoom;

      console.log(`Doctor ${doctorId} joined room ${doctorPrivateRoom}`);
      console.log("Socket user type set to:", socket.userType);

      socket.emit("doctorRoomJoined", {
        success: true,
        doctorId,
        message: "Successfully joined doctor room",
      });

      // Get queue and current patients
      const queue = await queueManager.getDoctorQueue(doctorId);
      console.log("Doctor queue fetched, patient count:", queue.length);

      // Join individual rooms for each patient in the queue
      for (const patient of queue) {
        const doctorPatientRoom = `doctor:${doctorId}:patient:${patient.id}`;
        await socket.join(doctorPatientRoom);
        currentRooms.add(doctorPatientRoom);
        console.log(
          `Doctor ${doctorId} joined patient room: ${doctorPatientRoom}`
        );
      }

      console.log({ currentRooms });

      socket.emit("queueChanged", { queue });
      console.log("=== DOCTOR ROOM SETUP COMPLETED ===");
    } catch (error) {
      console.error("Error in joinDoctorRoom:", error);
      socket.emit("error", {
        message: error.message,
        code: error.code || "JOIN_ROOM_ERROR",
        timestamp: new Date().toISOString(),
      });
    }
  });

  socket.on("updateDoctorAvailability", async (data) => {
    try {
      const { doctorId, isAvailable } = data;
      if (socket.userType !== "doctor" || socket.doctorId !== doctorId) return;

      await queueManager.updateDoctorAvailability(doctorId, isAvailable);
      console.log(`Updated doctor ${doctorId} availability to ${isAvailable}`);
    } catch (error) {
      socket.emit("error", {
        message: error.message,
        code: "UPDATE_AVAILABILITY_ERROR",
        timestamp: new Date().toISOString(),
      });
    }
  });

  socket.on("leaveRoom", async (data) => {
    const { roomId } = data;
    await socket.leave(roomId);
    currentRooms.delete(roomId);
    console.log(`Client ${socket.id} left room ${roomId}`);
  });

  socket.on("disconnect", () => {
    currentRooms.forEach(async (roomId) => {
      await socket.leave(roomId);
    });
    currentRooms.clear();
    console.log(`Client disconnected: ${socket.id}`);
  });

  socket.onAny((eventName, ...args) => {
    console.log(`Socket event received: ${eventName}`, args);
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

app.use("*", (req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: `Route ${req.originalUrl} not found`,
  });
});

async function startServer() {
  try {
    await databaseService.initialize();
    console.log("Database connected and initialized");

    const PORT = process.env.PORT || 3001;
    const HOST = process.env.HOST || "0.0.0.0";

    server.listen(PORT, HOST, () => {
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
