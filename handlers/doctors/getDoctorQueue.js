const { param } = require("express-validator");

const calculateWaitingTime = (joinedAt) => {
  const now = new Date();
  const diffInMinutes = Math.floor(
    (now.getTime() - new Date(joinedAt).getTime()) / (1000 * 60)
  );
  return diffInMinutes;
};

const getDoctorQueue = (queueManager) => async (req, res) => {
  const { doctorId } = req.params;

  try {
    const doctor = await queueManager.getDoctor(doctorId);
    if (!doctor) {
      return res.status(404).json({
        success: false,
        error: "Not Found",
        message: `Doctor with ID ${doctorId} not found`,
      });
    }

    const queue = await queueManager.getDoctorQueue(doctorId);
    const statistics = await queueManager.getQueueStatistics(doctorId);

    const enhancedQueue = queue.map((patient) => {
      let position = 0;
      let estimatedWaitTime = 0;

      if (patient.status === "waiting") {
        const waitingPatients = queue.filter((p) => p.status === "waiting");
        const patientIndex = waitingPatients.findIndex(
          (p) => p.id === patient.id
        );
        position = patientIndex + 1;
        estimatedWaitTime = patientIndex * doctor.average_consultation_time;
      }

      return {
        ...patient,
        position,
        estimatedWaitTime,
        waitingTime: calculateWaitingTime(patient.joined_at),
      };
    });
    
    const data = {
      doctor: {
        id: doctor.id,
        name: doctor.name,
        specialization: doctor.specialization,
        isAvailable: doctor.is_available,
        averageConsultationTime: doctor.average_consultation_time,
      },
      queue: enhancedQueue,
      statistics,
      queueSummary: {
        total: queue.length,
        waiting: queue.filter((p) => p.status === "waiting").length,
        consulting: queue.filter((p) => p.status === "consulting").length,
        completed: queue.filter((p) => p.status === "completed").length,
      },
    };

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    throw error;
  }
};

getDoctorQueue.validations = [
  param("doctorId").trim().notEmpty().withMessage("Doctor ID is required"),
];

module.exports = getDoctorQueue;
