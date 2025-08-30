const { param } = require("express-validator");

const getDoctorQueueStatistics = (queueManager) => async (req, res) => {
  const { doctorId } = req.params;

  const statistics = await queueManager.getQueueStatistics(doctorId);
  res.json({
    success: true,
    data: statistics,
  });
};

getDoctorQueueStatistics.validations = [
  param("doctorId").trim().notEmpty().withMessage("Doctor ID is required"),
];

module.exports = getDoctorQueueStatistics;
