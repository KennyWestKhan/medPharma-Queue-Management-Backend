const { param } = require("express-validator");
const calculateWaitingTime = require("../../utils/timeCalculator");

const getPatientDetails = (queueManager) => async (req, res) => {
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
    const patientData = {
      id: patient.id,
      name: patient.name,
      status: patient.status,
      estimatedDuration: patient.estimated_duration,
      joinedAt: patient.joined_at,
      consultationStartedAt: patient.consultation_started_at,
      consultationEndedAt: patient.consultation_ended_at,
      doctor: {
        id: patient.doctor_id,
        name: patient.doctor_name,
        specialization: patient.specialization,
        averageConsultationTime: patient.average_consultation_time,
      },
      queueStatus,
      waitingTime: calculateWaitingTime(patient.joined_at),
    };

    res.json({
      success: true,
      data: patientData,
    });
  } catch (error) {
    throw error;
  }
};

getPatientDetails.validations = [
  param("patientId").isUUID().withMessage("Invalid patient ID format"),
];

module.exports = getPatientDetails;
