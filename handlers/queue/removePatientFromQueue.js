const { param } = require("express-validator");
const { AppError, ErrorTypes } = require("../../utils/errorHandler");

const removePatientFromQueue = (queueManager) => async (req, res) => {
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
    throw appError;
  }
};

removePatientFromQueue.validations = [
  param("patientId").isUUID().withMessage("Invalid patient ID format"),
];

module.exports = removePatientFromQueue;
