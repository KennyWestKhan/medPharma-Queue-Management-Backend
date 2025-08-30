const { param, body } = require("express-validator");

const clearDoctorQueue = (queueManager) => async (req, res) => {
  const { doctorId } = req.params;
  const { statusFilter = "waiting" } = req.body;

  const removedCount = await queueManager.clearDoctorQueue(
    doctorId,
    statusFilter
  );
  res.json({
    success: true,
    message: `Queue cleared successfully. Removed ${removedCount} patients.`,
    data: {
      removedCount,
      statusFilter,
    },
  });
};

clearDoctorQueue.validations = [
  param("doctorId").trim().notEmpty().withMessage("Doctor ID is required"),
  body("confirm")
    .equals("true")
    .withMessage("Confirmation required to clear queue"),
  body("statusFilter")
    .optional()
    .isIn(["waiting", "next", "consulting"])
    .withMessage("Status filter must be one of: waiting, next, consulting"),
];

module.exports = clearDoctorQueue;
