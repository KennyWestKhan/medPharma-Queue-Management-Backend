const DurationCalculator = require("./durationCalculator");
class QueueManager {
  constructor(databaseService, socketIo) {
    this.db = databaseService;
    this.io = socketIo;
  }

  async addPatientToQueue(patientData) {
    const { name, doctorId } = patientData;

    const doctor = await this.db.getDoctorById(doctorId);
    if (!doctor) {
      throw new Error(`Doctor with ID ${doctorId} not found`);
    }

    if (!doctor.is_available) {
      throw new Error("Doctor is currently not available");
    }

    if (doctor.current_patient_count >= doctor.max_daily_patients) {
      throw new Error("Doctor has reached maximum daily patient capacity");
    }

    const currentQueue = await this.db.getWaitingPatients(doctorId);
    const queueLength = currentQueue.length;

    const estimatedDuration = DurationCalculator.calculateEstimatedDuration(
      doctor,
      queueLength
    );

    const explanation = DurationCalculator.getCalculationExplanation(
      doctor,
      queueLength
    );

    const patient = await this.db.createPatient({
      name: name.trim(),
      doctorId,
      estimatedDuration,
    });

    // Emit real-time updates
    await this.emitQueueUpdate(doctorId);
    await this.emitPatientAdded(patient.id, doctorId);

    console.log(`Patient ${patient.name} added to ${doctor.name}'s queue:`);
    console.log(`  - Estimated duration: ${estimatedDuration} minutes`);
    console.log(`  - Calculation: ${explanation}`);
    console.log(`  - Queue position: ${queueLength + 1}`);

    return patient;
  }

  async updatePatientStatus(patientId, status) {
    const validStatuses = ["waiting", "next", "consulting", "completed"];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status: ${status}`);
    }

    const patient = await this.db.getPatientById(patientId);
    if (!patient) {
      throw new Error(`Patient with ID ${patientId} not found`);
    }

    if (status === "consulting") {
      // Only one patient can be consulting at a time per doctor
      const consultingPatients = await this.db.getWaitingPatients(
        patient.doctor_id
      );
      const currentlyConsulting = consultingPatients.find(
        (p) => p.status === "consulting"
      );

      if (currentlyConsulting && currentlyConsulting.id !== patientId) {
        // Complete the current consultation first
        await this.db.updatePatientStatus(currentlyConsulting.id, "completed");
      }
    }

    const updatedPatient = await this.db.updatePatientStatus(patientId, status);

    // Auto-advance queue if consultation is completed
    if (status === "completed") {
      await this.autoAdvanceQueue(patient.doctor_id);
    }

    // Emit real-time updates
    const roomId = `doctor_${patient.doctor_id}`;
    this.io.to(roomId).emit("patientStatusUpdate", {
      patientId,
      status,
    });

    await this.emitQueueUpdate(patient.doctor_id);
    await this.updateQueuePositions(patient.doctor_id);

    console.log(`Patient ${patientId} status updated to ${status}`);
    return updatedPatient;
  }

  async removePatientFromQueue(patientId) {
    const patient = await this.db.getPatientById(patientId);
    if (!patient) {
      throw new Error(`Patient with ID ${patientId} not found`);
    }

    const doctorId = patient.doctor_id;
    const removed = await this.db.removePatient(patientId);

    if (removed) {
      // Emit real-time updates
      await this.emitPatientRemoved(patientId, doctorId);
      await this.emitQueueUpdate(doctorId);
      await this.updateQueuePositions(doctorId);

      console.log(`Patient ${patientId} removed from queue`);
    }

    return removed;
  }

  async getPatient(patientId) {
    return this.db.getPatientById(patientId);
  }

  // Queue Management
  async getDoctorQueue(doctorId) {
    const doctor = await this.db.getDoctorById(doctorId);
    if (!doctor) {
      throw new Error(`Doctor with ID ${doctorId} not found`);
    }

    return this.db.getDoctorQueue(doctorId);
  }

  async getPatientQueueStatus(patientId) {
    const patient = await this.db.getPatientById(patientId);
    if (!patient) {
      throw new Error(`Patient with ID ${patientId} not found`);
    }

    let position = 0;
    let estimatedWaitTime = 0;

    if (patient.status === "waiting" && position > 0) {
      position = await this.db.getPatientQueuePosition(patientId);

      const patientsAhead = position - 1;
      estimatedWaitTime = patientsAhead * patient.average_consultation_time;

      // throw new Error(
      //   `Patient with ID ${patientId} is already in waiting queue # ${position}. Estimated wait time: ${estimatedWaitTime} minutes`
      // );
    }

    return {
      patientId,
      position,
      estimatedWaitTime,
      status: patient.status,
    };
  }

  async getEstimatedWaitTimeForNewPatient(doctorId) {
    const doctor = await this.db.getDoctorById(doctorId);
    if (!doctor) {
      throw new Error(`Doctor with ID ${doctorId} not found`);
    }

    const waitingPatients = await this.db.getWaitingPatients(doctorId);
    // New patient would be at the end of the queue
    const position = waitingPatients.length + 1;
    console.log({
      waitingPatients,
      position,
      averageConsultationTime: doctor.average_consultation_time,
    });
    return position * doctor.average_consultation_time;
  }

  async getAllDoctors() {
    return this.db.getAllDoctors();
  }

  async getDoctor(doctorId) {
    return this.db.getDoctorById(doctorId);
  }

  async updateDoctorAvailability(doctorId, isAvailable) {
    const doctor = await this.db.getDoctorById(doctorId);
    if (!doctor) {
      throw new Error(`Doctor with ID ${doctorId} not found`);
    }

    const updatedDoctor = await this.db.updateDoctorAvailability(
      doctorId,
      isAvailable
    );

    // Emit real-time update
    const roomId = `doctor_${doctorId}`;
    this.io.to(roomId).emit("doctorAvailabilityUpdate", {
      doctorId,
      isAvailable,
    });

    console.log(`Doctor ${doctorId} availability updated to ${isAvailable}`);
    return updatedDoctor;
  }

  // Statistics
  async getQueueStatistics(doctorId) {
    const doctor = await this.db.getDoctorById(doctorId);
    if (!doctor) {
      throw new Error(`Doctor with ID ${doctorId} not found`);
    }

    return this.db.getQueueStatistics(doctorId);
  }

  async getDashboardStats() {
    const doctors = await this.db.getAllDoctors();

    const totalStats = {
      totalDoctors: doctors.length,
      availableDoctors: doctors.filter((d) => d.is_available).length,
      totalPatientsWaiting: doctors.reduce(
        (sum, d) => sum + parseInt(d.waiting_patient_count),
        0
      ),
      totalPatientsInSystem: doctors.reduce(
        (sum, d) => sum + parseInt(d.current_patient_count),
        0
      ),
    };

    return {
      totalStats,
      doctors: doctors.map((doctor) => ({
        id: doctor.id,
        name: doctor.name,
        specialization: doctor.specialization,
        isAvailable: doctor.is_available,
        currentPatientCount: parseInt(doctor.current_patient_count),
        waitingPatientCount: parseInt(doctor.waiting_patient_count),
        averageConsultationTime: doctor.average_consultation_time,
      })),
    };
  }

  // Queue Operations
  async autoAdvanceQueue(doctorId) {
    const waitingPatients = await this.db.getWaitingPatients(doctorId);

    if (waitingPatients.length > 0) {
      const nextPatient = waitingPatients[0];
      await this.db.updatePatientStatus(nextPatient.id, "next");

      // Emit update for the next patient
      const roomId = `doctor_${doctorId}`;
      this.io.to(roomId).emit("patientStatusUpdate", {
        patientId: nextPatient.id,
        status: "next",
      });

      console.log(`Auto-advanced patient ${nextPatient.id} to 'next' status`);
    }
  }

  async clearDoctorQueue(doctorId, statusFilter = "waiting") {
    const doctor = await this.db.getDoctorById(doctorId);
    if (!doctor) {
      throw new Error(`Doctor with ID ${doctorId} not found`);
    }

    const removedCount = await this.db.clearDoctorQueue(doctorId, statusFilter);

    if (removedCount > 0) {
      // Emit queue update
      await this.emitQueueUpdate(doctorId);
      console.log(
        `Cleared ${removedCount} patients from doctor ${doctorId}'s queue`
      );
    }

    return removedCount;
  }

  async emitQueueUpdate(doctorId) {
    try {
      const roomId = `doctor_${doctorId}`;
      const queue = await this.db.getDoctorQueue(doctorId);
      this.io.to(roomId).emit("queueChanged", { queue });
    } catch (error) {
      console.error("Failed to emit queue update:", error);
    }
  }

  async updateQueuePositions(doctorId) {
    try {
      const waitingPatients = await this.db.getWaitingPatients(doctorId);
      const doctor = await this.db.getDoctorById(doctorId);

      if (!doctor) return;

      const roomId = `doctor_${doctorId}`;

      waitingPatients.forEach((patient, index) => {
        const position = index + 1;
        const estimatedWaitTime =
          position > 0 ? (position - 1) * doctor.average_consultation_time : 0;

        const { id: patientId } = patient;
        this.io.to(roomId).emit("queueUpdate", {
          patientId,
          position,
          estimatedWaitTime,
        });
      });
    } catch (error) {
      console.error("Failed to update queue positions:", error);
    }
  }

  async emitPatientAdded(patientId, doctorId) {
    try {
      const roomId = `doctor_${doctorId}`;
      const patient = await this.db.getPatientById(patientId);

      if (patient) {
        this.io.to(roomId).emit("patientAdded", patient);
      }
    } catch (error) {
      console.error("Failed to emit patient added:", error);
    }
  }

  async emitPatientRemoved(patientId, doctorId) {
    try {
      const roomId = `doctor_${doctorId}`;
      this.io.to(roomId).emit("patientRemoved", { patientId });
    } catch (error) {
      console.error("Failed to emit patient removed:", error);
    }
  }

  async performMaintenanceCleanup() {
    try {
      const removedCount = await this.db.cleanupOldPatients();
      console.log(
        `Maintenance cleanup: removed ${removedCount} old patient records`
      );
      return removedCount;
    } catch (error) {
      console.error("Failed to perform maintenance cleanup:", error);
      throw error;
    }
  }

  async getHealthStatus() {
    try {
      const dbHealth = await this.db.healthCheck();
      const totalDoctors = await this.db.getAllDoctors();

      return {
        status: "healthy",
        database: dbHealth,
        totalDoctors: totalDoctors.length,
        connectedClients: this.io.engine.clientsCount,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: "unhealthy",
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}

module.exports = QueueManager;
