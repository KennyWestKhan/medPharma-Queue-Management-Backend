const getAllDoctors = (queueManager) => async (req, res) => {
  try {
    const doctors = await queueManager.getAllDoctors();

    const transformedDoctors = doctors.map((doctor) => ({
      id: doctor.id,
      name: doctor.name,
      specialization: doctor.specialization,
      isAvailable: doctor.is_available,
      averageConsultationTime: doctor.average_consultation_time,
      maxDailyPatients: doctor.max_daily_patients,
      consultationFee: doctor.consultation_fee,
      bio: doctor.bio,
      profileImageUrl: doctor.profile_image_url,
      currentPatientCount: parseInt(doctor.current_patient_count) || 0,
      waitingPatientCount: parseInt(doctor.waiting_patient_count) || 0,
      isAtCapacity:
        parseInt(doctor.current_patient_count) >= doctor.max_daily_patients,
      createdAt: doctor.created_at,
      updatedAt: doctor.updated_at,
    }));

    res.json({
      success: true,
      data: {
        doctors: transformedDoctors,
        total: transformedDoctors.length,
        available: transformedDoctors.filter((d) => d.isAvailable).length,
      },
    });
  } catch (error) {
    throw error;
  }
};

module.exports = getAllDoctors;
