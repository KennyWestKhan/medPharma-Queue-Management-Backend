const { param, body } = require("express-validator");

const updateDoctorStatus = (queueManager) => async (req, res) => {
  try {
    const { doctorId } = req.params;
    const { isAvailable } = req.body;

    const updated = await queueManager.updateDoctorAvailability(
      doctorId,
      isAvailable
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: "Doctor not found",
      });
    }

    res.json({
      success: true,
      data: {
        message: `Doctor status updated successfully to ${
          isAvailable ? "available" : "unavailable"
        }`,
        doctorId,
        isAvailable,
      },
    });
  } catch (error) {
    throw error;
  }
};

updateDoctorStatus.validations = [
  param("doctorId").trim().notEmpty().withMessage("Doctor ID is required"),
  body("isAvailable")
    .isBoolean()
    .withMessage("isAvailable must be a boolean value"),
];

module.exports = updateDoctorStatus;
