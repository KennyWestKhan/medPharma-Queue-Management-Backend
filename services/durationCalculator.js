//pulled possible estimation time from online
class DurationCalculator {
  static SPECIALIZATION_MULTIPLIERS = {
    "General Medicine": 1.0, // Baseline
    Cardiology: 1.3, // More complex consultations
    Pediatrics: 1.1, // Slightly longer for children
    Dermatology: 0.8, // Often quicker visual assessments
    "Internal Medicine": 1.2, // Complex adult conditions
    "Emergency Medicine": 0.9, // Need to be efficient
    Surgery: 1.5, // Pre/post surgical consultations
    Psychiatry: 1.8, // Mental health takes time
    Orthopedics: 1.1, // Physical assessments
  };

  // Time of day factors (people are more tired later)
  static getTimeOfDayMultiplier() {
    const hour = new Date().getHours();
    if (hour < 9) return 1.1; // Early morning - slower
    if (hour < 12) return 1.0; // Morning - optimal
    if (hour < 14) return 1.05; // Lunch time - slightly slower
    if (hour < 17) return 1.0; // Afternoon - optimal
    if (hour < 19) return 1.1; // Evening - slower
    return 1.2; // Late evening - much slower
  }

  // Day of week factors
  static getDayOfWeekMultiplier() {
    const day = new Date().getDay();
    switch (day) {
      case 1:
        return 1.1; // Monday - slower start
      case 2:
      case 3:
      case 4:
        return 1.0; // Tuesday Wednesday Thursday - optimal
      case 5:
        return 1.05; // Friday - slightly distracted
      case 6:
        return 1.15; // Saturday - weekend mode
      case 0:
        return 1.2; // Sunday - very relaxed
      default:
        return 1.0;
    }
  }

  // Queue length impact (doctors may rush or take more time based on queue)
  static getQueueLengthMultiplier(queueLength) {
    if (queueLength <= 2) return 1.0; // Normal pace
    if (queueLength <= 5) return 0.95; // Slightly faster
    if (queueLength <= 10) return 0.9; // Noticeably faster
    return 0.85; // Rush mode
  }

  static getDoctorExperienceMultiplier(doctorId) {
    // simulating based on doctor ID. ideally there'd be a profile on each doctor where this will be pulled from
    const experienceLevels = {
      doc1: 0.95, // Dr. Prince Bondzie
      doc2: 0.9, // Dr. Yaw Asamoah
      doc3: 1.0, // Dr. Hughes Debazaa
      doc4: 0.92, // Dr. Kiki Smith
      doc5: 0.88, // Dr. Jemilu Mohammed
    };
    return experienceLevels[doctorId] || 1.0;
  }

  // Main calculation method
  static calculateEstimatedDuration(doctor, currentQueueLength = 0) {
    const baseTime = doctor.average_consultation_time;
    const specialization = doctor.specialization;

    // Get all multipliers
    const specializationMultiplier =
      this.SPECIALIZATION_MULTIPLIERS[specialization] || 1.0;
    const timeMultiplier = this.getTimeOfDayMultiplier();
    const dayMultiplier = this.getDayOfWeekMultiplier();
    const queueMultiplier = this.getQueueLengthMultiplier(currentQueueLength);
    const experienceMultiplier = this.getDoctorExperienceMultiplier(doctor.id);

    // Calculate estimated duration
    let estimatedDuration =
      baseTime *
      specializationMultiplier *
      timeMultiplier *
      dayMultiplier *
      queueMultiplier *
      experienceMultiplier;

    // random variance (±2 minutes)
    const variance = (Math.random() - 0.5) * 4;
    estimatedDuration += variance;

    estimatedDuration = Math.round(estimatedDuration);
    estimatedDuration = Math.max(5, Math.min(60, estimatedDuration));

    console.log(`Duration calculation for ${doctor.name}:`, {
      baseTime,
      specialization: `${specialization} (${specializationMultiplier}x)`,
      timeOfDay: `${timeMultiplier}x`,
      dayOfWeek: `${dayMultiplier}x`,
      queueLength: `${currentQueueLength} patients (${queueMultiplier}x)`,
      experience: `${experienceMultiplier}x`,
      variance: `${variance.toFixed(1)} min`,
      finalDuration: `${estimatedDuration} minutes`,
    });

    return estimatedDuration;
  }

  static calculateSimpleDuration(doctor) {
    const baseTime = doctor.average_consultation_time;
    const variance = Math.floor(Math.random() * 6) - 3; // ±3 minutes
    return Math.max(5, baseTime + variance);
  }

  // Get human-readable explanation of duration factors
  static getCalculationExplanation(doctor, currentQueueLength = 0) {
    const factors = [];

    const specializationMultiplier =
      this.SPECIALIZATION_MULTIPLIERS[doctor.specialization] || 1.0;
    if (specializationMultiplier > 1.0) {
      factors.push(
        `${doctor.specialization} consultations typically take longer`
      );
    } else if (specializationMultiplier < 1.0) {
      factors.push(`${doctor.specialization} consultations are often quicker`);
    }

    const hour = new Date().getHours();
    if (hour < 9 || hour > 17) {
      factors.push("consultations outside regular hours may take longer");
    }

    if (currentQueueLength > 5) {
      factors.push("doctor may work faster due to queue length");
    }

    return factors.length > 0
      ? `Estimated duration considers: ${factors.join(", ")}`
      : "Estimated duration based on doctor's average consultation time";
  }
}

module.exports = DurationCalculator;
