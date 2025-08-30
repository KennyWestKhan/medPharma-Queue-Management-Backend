const { param, body } = require("express-validator");
const { AppError, ErrorTypes } = require("../../utils/errorHandler");

const updatePatientQueueStatus = (queueManager) => async (req, res) => {
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
};

updatePatientQueueStatus.validations = [
  param("patientId").isUUID().withMessage("Invalid patient ID format"),
  body("status")
    .isIn(["waiting", "next", "consulting", "completed"])
    .withMessage("Status must be one of: waiting, next, consulting, completed"),
];

module.exports = updatePatientQueueStatus;
