const getDoctorStatistics = (queueManager) => async (req, res) => {
  const { doctorId } = req.params;

  try {
    const statistics = await queueManager.getQueueStatistics(doctorId);
    const doctor = await queueManager.getDoctor(doctorId);

    if (!doctor) {
      return res.status(404).json({
        success: false,
        error: "Not Found",
        message: `Doctor with ID ${doctorId} not found`,
      });
    }

    res.json({
      success: true,
      data: {
        doctorId: doctor.id,
        doctorName: doctor.name,
        statistics,
        isAvailable: doctor.is_available,
        averageConsultationTime: doctor.average_consultation_time,
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

getDoctorStatistics.validations = [
  require('express-validator').param("doctorId").trim().notEmpty().withMessage("Doctor ID is required"),
];

module.exports = getDoctorStatistics;
