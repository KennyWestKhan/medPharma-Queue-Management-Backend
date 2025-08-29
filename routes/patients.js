const express = require("express");
const { param, body, query, validationResult } = require("express-validator");

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

function createPatientRoutes(queueManager) {
  const router = express.Router();

  router.post(
    "/add-patient",
    [
      body("name")
        .trim()
        .isLength({ min: 1, max: 100 })
        .withMessage("Name must be between 1 and 100 characters"),
      body("doctorId").trim().notEmpty().withMessage("Doctor ID is required"),
      body("estimatedDuration")
        .optional()
        .isInt({ min: 5, max: 60 })
        .withMessage("Estimated duration must be between 5 and 60 minutes"),
      handleValidationErrors,
    ],
    asyncHandler(async (req, res) => {
      const { name, doctorId } = req.body;

      const estimatedWaitTime =
        await queueManager.getEstimatedWaitTimeForNewPatient(doctorId);

      const patient = await queueManager.addPatientToQueue({
        name,
        doctorId,
      });

      res.status(201).json({
        success: true,
        message: "Patient added to queue successfully",
        data: {
          patient,
          estimatedWaitTime,
        },
      });
    })
  );

  router.get(
    "/:patientId",
    [
      param("patientId").isUUID().withMessage("Invalid patient ID format"),
      handleValidationErrors,
    ],
    asyncHandler(async (req, res) => {
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
    })
  );

  router.get(
    "/:patientId/queue-status",
    [
      param("patientId").isUUID().withMessage("Invalid patient ID format"),
      handleValidationErrors,
    ],
    asyncHandler(async (req, res) => {
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
        const doctorQueue = await queueManager.getDoctorQueue(
          patient.doctor_id
        );
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
              estimatedQueueTime:
                waitingCount * doctor.average_consultation_time,
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
    })
  );

  router.patch(
    "/:patientId/status",
    [
      param("patientId").isUUID().withMessage("Invalid patient ID format"),
      body("status")
        .isIn(["waiting", "next", "consulting", "completed"])
        .withMessage(
          "Status must be one of: waiting, next, consulting, completed"
        ),
      body("notes")
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage("Notes must not exceed 500 characters"),
      handleValidationErrors,
    ],
    asyncHandler(async (req, res) => {
      const { patientId } = req.params;
      const { status, notes } = req.body;

      try {
        const updatedPatient = await queueManager.updatePatientStatus(
          patientId,
          status
        );

        console.log(
          `Patient ${patientId} status changed to ${status}${
            notes ? ` - Notes: ${notes}` : ""
          }`
        );

        res.json({
          success: true,
          message: `Patient status updated to ${status}`,
          data: {
            id: updatedPatient.id,
            status: updatedPatient.status,
            updatedAt: updatedPatient.updated_at,
            consultationStartedAt: updatedPatient.consultation_started_at,
            consultationEndedAt: updatedPatient.consultation_ended_at,
            notes,
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

  router.delete(
    "/:patientId",
    [
      param("patientId").isUUID().withMessage("Invalid patient ID format"),
      body("reason")
        .optional()
        .trim()
        .isLength({ min: 3, max: 200 })
        .withMessage("Reason must be between 3 and 200 characters if provided"),
      handleValidationErrors,
    ],
    asyncHandler(async (req, res) => {
      const { patientId } = req.params;
      const { reason } = req.body;

      try {
        const patient = await queueManager.getPatient(patientId);
        if (!patient) {
          return res.status(404).json({
            success: false,
            error: "Not Found",
            message: `Patient with ID ${patientId} not found`,
          });
        }

        const removed = await queueManager.removePatientFromQueue(patientId);

        if (removed) {
          console.log(
            `Patient ${patient.name} (${patientId}) removed from queue${
              reason ? ` - Reason: ${reason}` : ""
            }`
          );

          res.json({
            success: true,
            message: "Patient removed from queue successfully",
            data: {
              patientId,
              patientName: patient.name,
              doctorId: patient.doctor_id,
              removedAt: new Date().toISOString(),
              reason: reason || "No reason provided",
            },
          });
        } else {
          res.status(404).json({
            success: false,
            error: "Not Found",
            message: "Patient not found or already removed",
          });
        }
      } catch (error) {
        throw error;
      }
    })
  );

  router.get(
    "/:patientId/position-history",
    [
      param("patientId").isUUID().withMessage("Invalid patient ID format"),
      handleValidationErrors,
    ],
    asyncHandler(async (req, res) => {
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
        const currentTime = new Date().toISOString();

        const mockHistory = [
          {
            timestamp: patient.joined_at,
            position: "N/A",
            status: "waiting",
            event: "Joined queue",
          },
        ];

        if (patient.status !== "waiting") {
          mockHistory.push({
            timestamp: patient.consultation_started_at || currentTime,
            position: queueStatus.position,
            status: patient.status,
            event: getStatusEvent(patient.status),
          });
        }

        res.json({
          success: true,
          data: {
            patientId,
            patientName: patient.name,
            currentStatus: patient.status,
            currentPosition: queueStatus.position,
            history: mockHistory,
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
    "/:patientId/estimated-completion",
    [
      param("patientId").isUUID().withMessage("Invalid patient ID format"),
      handleValidationErrors,
    ],
    asyncHandler(async (req, res) => {
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
        const doctor = await queueManager.getDoctor(patient.doctor_id);

        let estimatedCompletionTime = null;
        let estimatedStartTime = null;

        if (patient.status === "waiting" && queueStatus.position > 0) {
          const now = new Date();
          const waitTimeMs = queueStatus.estimatedWaitTime * 60 * 1000;
          estimatedStartTime = new Date(now.getTime() + waitTimeMs);
          estimatedCompletionTime = new Date(
            estimatedStartTime.getTime() +
              doctor.average_consultation_time * 60 * 1000
          );
        } else if (
          patient.status === "consulting" &&
          patient.consultation_started_at
        ) {
          const startTime = new Date(patient.consultation_started_at);
          estimatedCompletionTime = new Date(
            startTime.getTime() + doctor.average_consultation_time * 60 * 1000
          );
        }

        res.json({
          success: true,
          data: {
            patientId,
            currentStatus: patient.status,
            queuePosition: queueStatus.position,
            estimatedWaitTime: queueStatus.estimatedWaitTime,
            estimatedStartTime,
            estimatedCompletionTime,
            consultationDuration: doctor.average_consultation_time,
            timestamps: {
              joinedAt: patient.joined_at,
              consultationStartedAt: patient.consultation_started_at,
              consultationEndedAt: patient.consultation_ended_at,
            },
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

function calculateWaitingTime(joinedAt) {
  const now = new Date();
  const diffInMinutes = Math.floor(
    (now.getTime() - new Date(joinedAt).getTime()) / (1000 * 60)
  );
  return Math.max(0, diffInMinutes);
}

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

function getStatusEvent(status) {
  const events = {
    waiting: "Added to waiting queue",
    next: "Moved to next in line",
    consulting: "Consultation started",
    completed: "Consultation completed",
  };

  return events[status] || "Status updated";
}

module.exports = createPatientRoutes;
