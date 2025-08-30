const { param } = require("express-validator");

const getDoctorQueue = (queueManager) => async (req, res) => {
  const { doctorId } = req.params;

  const queue = await queueManager.getDoctorQueue(doctorId);
  const statistics = await queueManager.getQueueStatistics(doctorId);

  res.json({
    success: true,
    data: {
      queue,
      statistics,
    },
  });
};

getDoctorQueue.validations = [
  param("doctorId").trim().notEmpty().withMessage("Doctor ID is required"),
];

module.exports = getDoctorQueue;
