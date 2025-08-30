const express = require("express");
const { validationResult } = require("express-validator");

// Import handlers
const addPatient = require("../handlers/patients/addPatient");
const getPatientDetails = require("../handlers/patients/getPatientDetails");
const getQueueStatus = require("../handlers/patients/getQueueStatus");
const updatePatientStatus = require("../handlers/patients/updatePatientStatus");
const removePatient = require("../handlers/patients/removePatient");
const getPositionHistory = require("../handlers/patients/getPositionHistory");
const getEstimatedCompletion = require("../handlers/patients/getEstimatedCompletion");

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

const getValidations = (handler) => {
  return handler.validations || [];
};

function createPatientRoutes(queueManager) {
  const router = express.Router();

  router.post(
    "/add-patient",
    getValidations(addPatient),
    handleValidationErrors,
    asyncHandler(addPatient(queueManager))
  );

  router.get(
    "/:patientId",
    getValidations(getPatientDetails),
    handleValidationErrors,
    asyncHandler(getPatientDetails(queueManager))
  );

  router.get(
    "/:patientId/queue-status",
    getValidations(getQueueStatus),
    handleValidationErrors,
    asyncHandler(getQueueStatus(queueManager))
  );

  router.patch(
    "/:patientId/status",
    getValidations(updatePatientStatus),
    handleValidationErrors,
    asyncHandler(updatePatientStatus(queueManager))
  );

  router.delete(
    "/:patientId",
    getValidations(removePatient),
    handleValidationErrors,
    asyncHandler(removePatient(queueManager))
  );

  router.get(
    "/:patientId/position-history",
    getValidations(getPositionHistory),
    handleValidationErrors,
    asyncHandler(getPositionHistory(queueManager))
  );

  router.get(
    "/:patientId/estimated-completion",
    getValidations(getEstimatedCompletion),
    handleValidationErrors,
    asyncHandler(getEstimatedCompletion(queueManager))
  );

  return router;
}

module.exports = createPatientRoutes;
