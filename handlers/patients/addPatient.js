const { body } = require("express-validator");
const addPatient = (queueManager) => async (req, res) => {
  const { name, doctorId } = req.body;
  const estimatedWaitTime =
    await queueManager.getEstimatedWaitTimeForNewPatient(doctorId);
  const patient = await queueManager.addPatientToQueue({ name, doctorId });

  res.status(201).json({
    success: true,
    message: "Patient added to queue successfully",
    data: {
      patient,
      estimatedWaitTime,
    },
  });
};

addPatient.validations = [
  body("name")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Name must be between 1 and 100 characters"),
  body("doctorId").trim().notEmpty().withMessage("Doctor ID is required"),
  body("estimatedDuration")
    .optional()
    .isInt({ min: 5, max: 60 })
    .withMessage("Estimated duration must be between 5 and 60 minutes"),
];

module.exports = addPatient;
