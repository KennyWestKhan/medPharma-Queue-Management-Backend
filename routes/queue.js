const express = require("express");
const { validationResult } = require("express-validator");
const {
  AppError,
  ErrorTypes,
  formatErrorResponse,
} = require("../utils/errorHandler");

const getPatientQueueStatus = require("../handlers/queue/getPatientQueueStatus");
const updatePatientQueueStatus = require("../handlers/queue/updatePatientQueueStatus");
const removePatientFromQueue = require("../handlers/queue/removePatientFromQueue");
const getDoctorQueue = require("../handlers/queue/getDoctorQueue");
const getDoctorQueueStatistics = require("../handlers/queue/getDoctorQueueStatistics");
const getEstimatedWaitTime = require("../handlers/queue/getEstimatedWaitTime");
const clearDoctorQueue = require("../handlers/queue/clearDoctorQueue");
const getDashboardStats = require("../handlers/queue/getDashboardStats");
const performMaintenanceCleanup = require("../handlers/queue/performMaintenanceCleanup");
const getHealthStatus = require("../handlers/queue/getHealthStatus");

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

// Get validations from handler
const getValidations = (handler) => {
  return handler.validations || [];
};

function createQueueRoutes(queueManager) {
  const router = express.Router();

  // Patient queue routes
  router.get(
    "/:patientId/status",
    getValidations(getPatientQueueStatus),
    handleValidationErrors,
    asyncHandler(getPatientQueueStatus(queueManager))
  );

  router.patch(
    "/:patientId/status",
    getValidations(updatePatientQueueStatus),
    handleValidationErrors,
    asyncHandler(updatePatientQueueStatus(queueManager))
  );

  router.delete(
    "/:patientId",
    getValidations(removePatientFromQueue),
    handleValidationErrors,
    asyncHandler(removePatientFromQueue(queueManager))
  );

  // Doctor queue routes
  router.get(
    "/doctor/:doctorId",
    getValidations(getDoctorQueue),
    handleValidationErrors,
    asyncHandler(getDoctorQueue(queueManager))
  );

  router.get(
    "/doctor/:doctorId/statistics",
    getValidations(getDoctorQueueStatistics),
    handleValidationErrors,
    asyncHandler(getDoctorQueueStatistics(queueManager))
  );

  router.get(
    "/doctor/:doctorId/estimated-wait-time",
    getValidations(getEstimatedWaitTime),
    handleValidationErrors,
    asyncHandler(getEstimatedWaitTime(queueManager))
  );

  router.delete(
    "/doctor/:doctorId/clear",
    getValidations(clearDoctorQueue),
    handleValidationErrors,
    asyncHandler(clearDoctorQueue(queueManager))
  );

  // Dashboard and maintenance routes
  router.get("/dashboard/stats", asyncHandler(getDashboardStats(queueManager)));

  router.post(
    "/maintenance/cleanup",
    asyncHandler(performMaintenanceCleanup(queueManager))
  );

  router.get("/health", asyncHandler(getHealthStatus(queueManager)));

  router.use(handleErrors);

  return router;
}

module.exports = { createQueueRoutes, handleErrors, AppError, ErrorTypes };
