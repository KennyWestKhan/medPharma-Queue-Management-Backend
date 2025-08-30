const { param, body } = require("express-validator");

const updatePatientStatus = (queueManager) => async (req, res) => {
  const { patientId } = req.params;
  const { status, notes } = req.body;

  try {
    const updatedPatient = await queueManager.updatePatientStatus(
      patientId,
      status
    );

    console.log(
      `Patient ${patientId} status changed to ${status}${
        notes ? ` - Notes: ${notes}` : ""
      }`
    );

    res.json({
      success: true,
      message: `Patient status updated to ${status}`,
      data: {
        id: updatedPatient.id,
        status: updatedPatient.status,
        updatedAt: updatedPatient.updated_at,
        consultationStartedAt: updatedPatient.consultation_started_at,
        consultationEndedAt: updatedPatient.consultation_ended_at,
        notes,
      },
    });
  } catch (error) {
    if (error.message.includes("not found")) {
      return res.status(404).json({
        success: false,
        error: "Not Found",
        message: error.message,
      });
    }
    throw error;
  }
};

updatePatientStatus.validations = [
  param("patientId").isUUID().withMessage("Invalid patient ID format"),
  body("status")
    .isIn(["waiting", "next", "consulting", "completed"])
    .withMessage("Status must be one of: waiting, next, consulting, completed"),
  body("notes")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Notes must not exceed 500 characters"),
];

module.exports = updatePatientStatus;
