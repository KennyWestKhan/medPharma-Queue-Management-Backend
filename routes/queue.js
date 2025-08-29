const express = require("express");
const { body, param, query, validationResult } = require("express-validator");

// Centralized error handling utilities
class AppError extends Error {
  constructor(message, statusCode, errorCode = null) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Error types for consistent error handling
const ErrorTypes = {
  VALIDATION: { statusCode: 400, errorCode: "VALIDATION_ERROR" },
  NOT_FOUND: { statusCode: 404, errorCode: "NOT_FOUND" },
  BAD_REQUEST: { statusCode: 400, errorCode: "BAD_REQUEST" },
  UNAUTHORIZED: { statusCode: 401, errorCode: "UNAUTHORIZED" },
  FORBIDDEN: { statusCode: 403, errorCode: "FORBIDDEN" },
  CONFLICT: { statusCode: 409, errorCode: "CONFLICT" },
  INTERNAL_SERVER: { statusCode: 500, errorCode: "INTERNAL_SERVER_ERROR" },
};

// Error response formatter
const formatErrorResponse = (error, includeDetails = false) => {
  const response = {
    success: false,
    error: error.errorCode || "ERROR",
    message: error.message,
    timestamp: new Date().toISOString(),
  };

  if (includeDetails && process.env.NODE_ENV !== "production") {
    response.details = error.stack;
  }

  return response;
};

// Error handler middleware
const handleErrors = (error, req, res, next) => {
  console.error("Error in queue routes:", error);

  // Handle known application errors
  if (error instanceof AppError) {
    return res.status(error.statusCode).json(formatErrorResponse(error));
  }

  // Handle validation errors
  if (error.name === "ValidationError") {
    const appError = new AppError(
      "Validation failed",
      ErrorTypes.VALIDATION.statusCode,
      ErrorTypes.VALIDATION.errorCode
    );
    return res.status(appError.statusCode).json(formatErrorResponse(appError));
  }

  // Handle database errors
  if (error.code === "23505") {
    const appError = new AppError(
      "Resource already exists",
      ErrorTypes.CONFLICT.statusCode,
      ErrorTypes.CONFLICT.errorCode
    );
    return res.status(appError.statusCode).json(formatErrorResponse(appError));
  }

  // Handle unknown errors
  const appError = new AppError(
    "Internal server error",
    ErrorTypes.INTERNAL_SERVER.statusCode,
    ErrorTypes.INTERNAL_SERVER.errorCode
  );

  return res.status(appError.statusCode).json(formatErrorResponse(appError));
};

// Middleware for validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const appError = new AppError(
      "Invalid request data",
      ErrorTypes.VALIDATION.statusCode,
      ErrorTypes.VALIDATION.errorCode
    );
    appError.details = errors.array();
    return res.status(appError.statusCode).json(formatErrorResponse(appError));
  }
  next();
};

// Enhanced async handler with error categorization
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((error) => {
    // Categorize common error patterns
    if (error.message.includes("not found")) {
      const appError = new AppError(
        error.message,
        ErrorTypes.NOT_FOUND.statusCode,
        ErrorTypes.NOT_FOUND.errorCode
      );
      return next(appError);
    }

    if (
      error.message.includes("not available") ||
      error.message.includes("Invalid status") ||
      error.message.includes("already exists")
    ) {
      const appError = new AppError(
        error.message,
        ErrorTypes.BAD_REQUEST.statusCode,
        ErrorTypes.BAD_REQUEST.errorCode
      );
      return next(appError);
    }

    next(error);
  });
};

function createQueueRoutes(queueManager) {
  const router = express.Router();

  router.get(
    "/patient/:patientId/status",
    [
      param("patientId").isUUID().withMessage("Invalid patient ID format"),
      handleValidationErrors,
    ],
    asyncHandler(async (req, res) => {
      const { patientId } = req.params;

      const queueStatus = await queueManager.getPatientQueueStatus(patientId);
      res.json({
        success: true,
        data: queueStatus,
      });
    })
  );

  router.patch(
    "/patient/:patientId/status",
    [
      param("patientId").isUUID().withMessage("Invalid patient ID format"),
      body("status")
        .isIn(["waiting", "next", "consulting", "completed"])
        .withMessage(
          "Status must be one of: waiting, next, consulting, completed"
        ),
      handleValidationErrors,
    ],
    asyncHandler(async (req, res) => {
      const { patientId } = req.params;
      const { status } = req.body;

      const updatedPatient = await queueManager.updatePatientStatus(
        patientId,
        status
      );
      res.json({
        success: true,
        message: "Patient status updated successfully",
        data: updatedPatient,
      });
    })
  );

  router.delete(
    "/patient/:patientId",
    [
      param("patientId").isUUID().withMessage("Invalid patient ID format"),
      handleValidationErrors,
    ],
    asyncHandler(async (req, res) => {
      const { patientId } = req.params;

      const removed = await queueManager.removePatientFromQueue(patientId);
      if (removed) {
        res.json({
          success: true,
          message: "Patient removed from queue successfully",
        });
      } else {
        const appError = new AppError(
          "Patient not found",
          ErrorTypes.NOT_FOUND.statusCode,
          ErrorTypes.NOT_FOUND.errorCode
        );
        return res
          .status(appError.statusCode)
          .json(formatErrorResponse(appError));
      }
    })
  );

  router.get(
    "/doctor/:doctorId",
    [
      param("doctorId").trim().notEmpty().withMessage("Doctor ID is required"),
      handleValidationErrors,
    ],
    asyncHandler(async (req, res) => {
      const { doctorId } = req.params;

      const queue = await queueManager.getDoctorQueue(doctorId);
      const statistics = await queueManager.getQueueStatistics(doctorId);

      res.json({
        success: true,
        data: {
          queue,
          statistics,
        },
      });
    })
  );

  router.get(
    "/doctor/:doctorId/statistics",
    [
      param("doctorId").trim().notEmpty().withMessage("Doctor ID is required"),
      handleValidationErrors,
    ],
    asyncHandler(async (req, res) => {
      const { doctorId } = req.params;

      const statistics = await queueManager.getQueueStatistics(doctorId);
      res.json({
        success: true,
        data: statistics,
      });
    })
  );

  router.get(
    "/doctor/:doctorId/estimated-wait-time",
    [
      param("doctorId").trim().notEmpty().withMessage("Doctor ID is required"),
      handleValidationErrors,
    ],
    asyncHandler(async (req, res) => {
      const { doctorId } = req.params;

      const estimatedWaitTime =
        await queueManager.getEstimatedWaitTimeForNewPatient(doctorId);
      res.json({
        success: true,
        data: {
          doctorId,
          estimatedWaitTime,
          estimatedWaitTimeFormatted: formatWaitTime(estimatedWaitTime),
        },
      });
    })
  );

  // just in case it needed for an emergency
  router.delete(
    "/doctor/:doctorId/clear",
    [
      param("doctorId").trim().notEmpty().withMessage("Doctor ID is required"),
      body("confirm")
        .equals("true")
        .withMessage("Confirmation required to clear queue"),
      body("statusFilter")
        .optional()
        .isIn(["waiting", "next", "consulting"])
        .withMessage("Status filter must be one of: waiting, next, consulting"),
      handleValidationErrors,
    ],
    asyncHandler(async (req, res) => {
      const { doctorId } = req.params;
      const { statusFilter = "waiting" } = req.body;

      const removedCount = await queueManager.clearDoctorQueue(
        doctorId,
        statusFilter
      );
      res.json({
        success: true,
        message: `Queue cleared successfully. Removed ${removedCount} patients.`,
        data: {
          removedCount,
          statusFilter,
        },
      });
    })
  );

  router.get(
    "/dashboard/stats",
    asyncHandler(async (req, res) => {
      const stats = await queueManager.getDashboardStats();
      res.json({
        success: true,
        data: stats,
      });
    })
  );

  router.post(
    "/maintenance/cleanup",
    asyncHandler(async (req, res) => {
      const removedCount = await queueManager.performMaintenanceCleanup();
      res.json({
        success: true,
        message: `Maintenance cleanup completed. Removed ${removedCount} old records.`,
        data: {
          removedCount,
        },
      });
    })
  );

  router.get(
    "/health",
    asyncHandler(async (req, res) => {
      const health = await queueManager.getHealthStatus();
      res.json(health);
    })
  );

  router.use(handleErrors);

  return router;
}

function formatWaitTime(minutes) {
  if (minutes < 60) {
    return `${Math.round(minutes)} minutes`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${Math.round(remainingMinutes)}m`;
}

module.exports = { createQueueRoutes, handleErrors, AppError, ErrorTypes };
