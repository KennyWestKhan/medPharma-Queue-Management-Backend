const getAvailableDoctors = (queueManager) => async (req, res) => {
  try {
    const allDoctors = await queueManager.getAllDoctors();

    const availableDoctors = allDoctors
      .filter(
        (doctor) =>
          doctor.is_available &&
          parseInt(doctor.current_patient_count) < doctor.max_daily_patients
      )
      .map((doctor) => ({
        id: doctor.id,
        name: doctor.name,
        specialization: doctor.specialization,
        averageConsultationTime: doctor.average_consultation_time,
        consultationFee: doctor.consultation_fee,
        currentPatientCount: parseInt(doctor.current_patient_count) || 0,
        waitingPatientCount: parseInt(doctor.waiting_patient_count) || 0,
        estimatedWaitTime:
          (parseInt(doctor.waiting_patient_count) || 0) *
          doctor.average_consultation_time,
      }))
      .sort((a, b) => a.estimatedWaitTime - b.estimatedWaitTime);

    res.json({
      success: true,
      data: {
        availableDoctors,
        total: availableDoctors.length,
      },
    });
  } catch (error) {
    throw error;
  }
};

module.exports = getAvailableDoctors;
