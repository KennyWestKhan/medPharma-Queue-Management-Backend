const { param, body } = require("express-validator");

const removePatient = (queueManager) => async (req, res) => {
  const { patientId } = req.params;
  const { reason } = req.body;

  try {
    const patient = await queueManager.getPatient(patientId);
    if (!patient) {
      return res.status(404).json({
        success: false,
        error: "Not Found",
        message: `Patient with ID ${patientId} not found`,
      });
    }

    const removed = await queueManager.removePatientFromQueue(patientId);

    if (removed) {
      console.log(
        `Patient ${patient.name} (${patientId}) removed from queue${
          reason ? ` - Reason: ${reason}` : ""
        }`
      );

      res.json({
        success: true,
        message: "Patient removed from queue successfully",
        data: {
          patientId,
          patientName: patient.name,
          doctorId: patient.doctor_id,
          removedAt: new Date().toISOString(),
          reason: reason || "No reason provided",
        },
      });
    } else {
      res.status(404).json({
        success: false,
        error: "Not Found",
        message: "Patient not found or already removed",
      });
    }
  } catch (error) {
    throw error;
  }
};

removePatient.validations = [
  param("patientId").isUUID().withMessage("Invalid patient ID format"),
  body("reason")
    .optional()
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage("Reason must be between 3 and 200 characters if provided"),
];

module.exports = removePatient;
