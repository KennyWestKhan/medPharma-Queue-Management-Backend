const { param } = require("express-validator");
const formatWaitTime = require("../../utils/formatters");

const getEstimatedWaitTime = (queueManager) => async (req, res) => {
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
};

getEstimatedWaitTime.validations = [
  param("doctorId").trim().notEmpty().withMessage("Doctor ID is required"),
];

module.exports = getEstimatedWaitTime;
