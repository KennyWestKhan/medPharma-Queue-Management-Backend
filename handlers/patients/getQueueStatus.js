const { param } = require("express-validator");
const calculateWaitingTime = require("../../utils/timeCalculator");

const getQueueStatus = (queueManager) => async (req, res) => {
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
    const doctorQueue = await queueManager.getDoctorQueue(patient.doctor_id);
    const doctor = await queueManager.getDoctor(patient.doctor_id);

    const totalInQueue = doctorQueue.filter(
      (p) => p.status !== "completed"
    ).length;
    const waitingCount = doctorQueue.filter(
      (p) => p.status === "waiting"
    ).length;
    const consultingPatient = doctorQueue.find(
      (p) => p.status === "consulting"
    );

    res.json({
      success: true,
      data: {
        patient: {
          id: patient.id,
          name: patient.name,
          status: patient.status,
          joinedAt: patient.joined_at,
          waitingTime: calculateWaitingTime(patient.joined_at),
        },
        queueStatus,
        doctor: {
          id: doctor.id,
          name: doctor.name,
          specialization: doctor.specialization,
          isAvailable: doctor.is_available,
          averageConsultationTime: doctor.average_consultation_time,
        },
        queueInfo: {
          totalInQueue,
          waitingCount,
          isConsultingNow: consultingPatient ? consultingPatient.id : null,
          estimatedQueueTime: waitingCount * doctor.average_consultation_time,
        },
        nextActions: getNextActions(patient.status),
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

function getNextActions(status) {
  const actions = {
    waiting: [
      "Wait for your turn",
      "You can leave the queue if needed",
      "Monitor your position updates",
    ],
    next: [
      "Get ready for consultation",
      "Ensure stable internet connection",
      "Have your questions prepared",
    ],
    consulting: ["Consultation in progress", "Please remain available"],
    completed: ["Consultation completed", "You may now leave"],
  };

  return actions[status] || ["No actions available"];
}

getQueueStatus.validations = [
  param("patientId").isUUID().withMessage("Invalid patient ID format"),
];

module.exports = getQueueStatus;
