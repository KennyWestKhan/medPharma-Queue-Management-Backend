const express = require("express");
const { param, body, validationResult } = require("express-validator");

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: "Validation Error",
      message: "Invalid request data",
      details: errors.array(),
    });
  }
  next();
};

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

function createDoctorRoutes(queueManager) {
  const router = express.Router();

  // Get all doctors
  router.get(
    "/",
    asyncHandler(async (req, res) => {
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
    })
  );

  router.get(
    "/:doctorId",
    [
      param("doctorId").trim().notEmpty().withMessage("Doctor ID is required"),
      handleValidationErrors,
    ],
    asyncHandler(async (req, res) => {
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

        // Get additional queue information
        const queueStats = await queueManager.getQueueStatistics(doctorId);
        let currentQueue = await queueManager.getDoctorQueue(doctorId);
        console.log({ currentQueue });
        if (!Array.isArray(currentQueue)) {
          currentQueue = [];
        }
        currentQueue = currentQueue.map((patient) => ({
          id: patient.id,
          name: patient.name,
          status: patient.status,
          joinedAt: patient.joined_at,
          estimatedDuration: patient.estimated_duration,
        }));

        const {
          id,
          name,
          specialization,
          is_available,
          average_consultation_time,
          max_daily_patients,
          consultation_fee,
          bio,
          profile_image_url,
          current_patient_count,
          waiting_patient_count,
          created_at,
          updated_at,
        } = doctor;

        const transformedDoctor = {
          id,
          name,
          specialization,
          isAvailable: is_available,
          averageConsultationTime: average_consultation_time,
          maxDailyPatients: max_daily_patients,
          consultationFee: consultation_fee,
          bio,
          profileImageUrl: profile_image_url,
          currentPatientCount: parseInt(current_patient_count) || 0,
          waitingPatientCount: parseInt(waiting_patient_count) || 0,
          isAtCapacity: parseInt(current_patient_count) >= max_daily_patients,
          createdAt: created_at,
          updatedAt: updated_at,
          queueStats,
          currentQueue,
        };

        res.json({
          success: true,
          data: transformedDoctor,
        });
      } catch (error) {
        throw error;
      }
    })
  );

  router.patch(
    "/:doctorId/availability",
    [
      param("doctorId").trim().notEmpty().withMessage("Doctor ID is required"),
      body("isAvailable")
        .isBoolean()
        .withMessage("isAvailable must be a boolean value"),
      handleValidationErrors,
    ],
    asyncHandler(async (req, res) => {
      const { doctorId } = req.params;
      const { isAvailable } = req.body;

      try {
        const updatedDoctor = await queueManager.updateDoctorAvailability(
          doctorId,
          isAvailable
        );

        res.json({
          success: true,
          message: `Doctor availability updated to ${
            isAvailable ? "available" : "unavailable"
          }`,
          data: {
            id: updatedDoctor.id,
            name: updatedDoctor.name,
            isAvailable: updatedDoctor.is_available,
            updatedAt: updatedDoctor.updated_at,
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
    })
  );

  router.get(
    "/:doctorId/queue",
    [
      param("doctorId").trim().notEmpty().withMessage("Doctor ID is required"),
      handleValidationErrors,
    ],
    asyncHandler(async (req, res) => {
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

        const enhancedQueue = queue.map((patient, index) => {
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
    })
  );

  router.get(
    "/:doctorId/statistics",
    [
      param("doctorId").trim().notEmpty().withMessage("Doctor ID is required"),
      handleValidationErrors,
    ],
    asyncHandler(async (req, res) => {
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
    })
  );

  router.get(
    "/available/list",
    asyncHandler(async (req, res) => {
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
    })
  );

  // Emergency endpoint to clear all waiting patients for a doctor
  router.post(
    "/:doctorId/emergency/clear-queue",
    [
      param("doctorId").trim().notEmpty().withMessage("Doctor ID is required"),
      body("confirm")
        .equals("EMERGENCY_CLEAR")
        .withMessage("Emergency confirmation required"),
      body("reason")
        .trim()
        .isLength({ min: 10, max: 200 })
        .withMessage("Reason must be between 10 and 200 characters"),
      handleValidationErrors,
    ],
    asyncHandler(async (req, res) => {
      const { doctorId } = req.params;
      const { reason } = req.body;

      try {
        const removedCount = await queueManager.clearDoctorQueue(
          doctorId,
          "waiting"
        );

        // Log the emergency action (in a real app, you'd want to store this in an audit log)
        console.log(
          `EMERGENCY: Doctor ${doctorId} queue cleared. Reason: ${reason}. Removed ${removedCount} patients.`
        );

        res.json({
          success: true,
          message: `Emergency queue clear completed. ${removedCount} patients removed.`,
          data: {
            doctorId,
            removedCount,
            reason,
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
    })
  );

  return router;
}

// Helper function to calculate waiting time
function calculateWaitingTime(joinedAt) {
  const now = new Date();
  const diffInMinutes = Math.floor(
    (now.getTime() - new Date(joinedAt).getTime()) / (1000 * 60)
  );
  return diffInMinutes;
}

module.exports = createDoctorRoutes;
