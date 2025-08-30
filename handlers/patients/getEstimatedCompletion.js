const { param } = require("express-validator");

const getEstimatedCompletion = (queueManager) => async (req, res) => {
  const { patientId } = req.params;

  try {
    const patient = await queueManager.getPatient(patientId);
    if (!patient) {
      return res.status(404).json({
        success: false,
        error: "Not Found",
        message: `Patient with ID ${patientId} not found`,
      });
    }

    const queueStatus = await queueManager.getPatientQueueStatus(patientId);
    const doctor = await queueManager.getDoctor(patient.doctor_id);

    let estimatedCompletionTime = null;
    let estimatedStartTime = null;

    if (patient.status === "waiting" && queueStatus.position > 0) {
      const now = new Date();
      const waitTimeMs = queueStatus.estimatedWaitTime * 60 * 1000;
      estimatedStartTime = new Date(now.getTime() + waitTimeMs);
      estimatedCompletionTime = new Date(
        estimatedStartTime.getTime() +
          doctor.average_consultation_time * 60 * 1000
      );
    } else if (
      patient.status === "consulting" &&
      patient.consultation_started_at
    ) {
      const startTime = new Date(patient.consultation_started_at);
      estimatedCompletionTime = new Date(
        startTime.getTime() + doctor.average_consultation_time * 60 * 1000
      );
    }

    res.json({
      success: true,
      data: {
        patientId,
        currentStatus: patient.status,
        queuePosition: queueStatus.position,
        estimatedWaitTime: queueStatus.estimatedWaitTime,
        estimatedStartTime,
        estimatedCompletionTime,
        consultationDuration: doctor.average_consultation_time,
        timestamps: {
          joinedAt: patient.joined_at,
          consultationStartedAt: patient.consultation_started_at,
          consultationEndedAt: patient.consultation_ended_at,
        },
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

getEstimatedCompletion.validations = [
  param("patientId").isUUID().withMessage("Invalid patient ID format"),
];

module.exports = getEstimatedCompletion;
