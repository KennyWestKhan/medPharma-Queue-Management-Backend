const { param, body } = require("express-validator");

const clearDoctorQueue = (queueManager) => async (req, res) => {
  const { doctorId } = req.params;
  const { reason } = req.body;

  try {
    const removedCount = await queueManager.clearDoctorQueue(
      doctorId,
      "waiting"
    );

    // Log the emergency action (in a real app, you'd want to store this in an audit log)
    console.log(
      `EMERGENCY: Doctor ${doctorId} queue cleared. Reason: ${reason}. Removed ${removedCount} patients.`
    );

    res.json({
      success: true,
      message: `Emergency queue clear completed. ${removedCount} patients removed.`,
      data: {
        doctorId,
        removedCount,
        reason,
        timestamp: new Date().toISOString(),
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

clearDoctorQueue.validations = [
  param("doctorId").trim().notEmpty().withMessage("Doctor ID is required"),
  body("confirm")
    .equals("EMERGENCY_CLEAR")
    .withMessage("Emergency confirmation required"),
  body("reason")
    .trim()
    .isLength({ min: 10, max: 200 })
    .withMessage("Reason must be between 10 and 200 characters"),
];

module.exports = clearDoctorQueue;
