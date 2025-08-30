const { param } = require("express-validator");

const getDoctorDetails = (queueManager) => async (req, res) => {
  try {
    const { doctorId } = req.params;

    const doctorDetails = await queueManager.getDoctorDetailsWithQueue(
      doctorId
    );

    if (!doctorDetails) {
      return res.status(404).json({
        success: false,
        error: "Doctor not found",
      });
    }

    const transformedDetails = {
      id: doctorDetails.id,
      name: doctorDetails.name,
      specialization: doctorDetails.specialization,
      isAvailable: doctorDetails.is_available,
      averageConsultationTime: doctorDetails.average_consultation_time,
      maxDailyPatients: doctorDetails.max_daily_patients,
      consultationFee: doctorDetails.consultation_fee,
      bio: doctorDetails.bio,
      profileImageUrl: doctorDetails.profile_image_url,
      currentPatientCount: parseInt(doctorDetails.current_patient_count) || 0,
      waitingPatientCount: parseInt(doctorDetails.waiting_patient_count) || 0,
      isAtCapacity:
        parseInt(doctorDetails.current_patient_count) >=
        doctorDetails.max_daily_patients,
      currentQueue: doctorDetails.queue || [],
      createdAt: doctorDetails.created_at,
      updatedAt: doctorDetails.updated_at,
    };

    res.json({
      success: true,
      data: transformedDetails,
    });
  } catch (error) {
    throw error;
  }
};

getDoctorDetails.validations = [
  param("doctorId").trim().notEmpty().withMessage("Doctor ID is required"),
];

module.exports = getDoctorDetails;
