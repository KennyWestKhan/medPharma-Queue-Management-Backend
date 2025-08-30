const { param } = require("express-validator");

const getPatientQueueStatus = (queueManager) => async (req, res) => {
  const { patientId } = req.params;

  const queueStatus = await queueManager.getPatientQueueStatus(patientId);
  res.json({
    success: true,
    data: queueStatus,
  });
};

getPatientQueueStatus.validations = [
  param("patientId").isUUID().withMessage("Invalid patient ID format"),
];

module.exports = getPatientQueueStatus;
