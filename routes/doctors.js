const express = require("express");
const { validationResult } = require("express-validator");

// Import handlers
const getAllDoctors = require("../handlers/doctors/getAllDoctors");
const getDoctorDetails = require("../handlers/doctors/getDoctorDetails");
const updateDoctorStatus = require("../handlers/doctors/updateDoctorStatus");
const getDoctorQueue = require("../handlers/doctors/getDoctorQueue");
const getDoctorStatistics = require("../handlers/doctors/getDoctorStatistics");
const getAvailableDoctors = require("../handlers/doctors/getAvailableDoctors");
const clearDoctorQueue = require("../handlers/doctors/clearDoctorQueue");

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: "Validation Error",
      message: "Invalid request data",
      details: errors.array(),
    });
  }
  next();
};

// Async handler wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Create validation middleware from handler validations
const getValidations = (handler) => {
  return handler.validations || [];
};

function createDoctorRoutes(queueManager) {
  const router = express.Router();

  // Get all doctors
  router.get("/", asyncHandler(getAllDoctors(queueManager)));

  // Get available doctors
  router.get(
    "/available/list",
    asyncHandler(getAvailableDoctors(queueManager))
  );

  // Get specific doctor details
  router.get(
    "/:doctorId",
    getValidations(getDoctorDetails),
    handleValidationErrors,
    asyncHandler(getDoctorDetails(queueManager))
  );

  // Update doctor availability status
  router.patch(
    "/:doctorId/availability",
    getValidations(updateDoctorStatus),
    handleValidationErrors,
    asyncHandler(updateDoctorStatus(queueManager))
  );

  // Get doctor's queue
  router.get(
    "/:doctorId/queue",
    getValidations(getDoctorQueue),
    handleValidationErrors,
    asyncHandler(getDoctorQueue(queueManager))
  );

  // Get doctor's statistics
  router.get(
    "/:doctorId/statistics",
    getValidations(getDoctorStatistics),
    handleValidationErrors,
    asyncHandler(getDoctorStatistics(queueManager))
  );

  // Emergency queue clear
  router.post(
    "/:doctorId/emergency/clear-queue",
    getValidations(clearDoctorQueue),
    handleValidationErrors,
    asyncHandler(clearDoctorQueue(queueManager))
  );

  return router;
}

module.exports = createDoctorRoutes;
