const express = require("express");
const { body, param, query, validationResult } = require("express-validator");

// Middleware for validation errors
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

function createQueueRoutes(queueManager) {
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
      const { name, doctorId, estimatedDuration } = req.body;

      try {
        const patient = await queueManager.addPatientToQueue({
          name,
          doctorId,
          estimatedDuration,
        });

        res.status(201).json({
          success: true,
          message: "Patient added to queue successfully",
          data: {
            patient,
            estimatedWaitTime:
              await queueManager.getEstimatedWaitTimeForNewPatient(doctorId),
          },
        });
      } catch (error) {
        if (
          error.message.includes("not found") ||
          error.message.includes("not available")
        ) {
          return res.status(400).json({
            success: false,
            error: "Bad Request",
            message: error.message,
          });
        }
        throw error;
      }
    })
  );

  router.get(
    "/patient/:patientId/status",
    [
      param("patientId").isUUID().withMessage("Invalid patient ID format"),
      handleValidationErrors,
    ],
    asyncHandler(async (req, res) => {
      const { patientId } = req.params;

      try {
        const queueStatus = await queueManager.getPatientQueueStatus(patientId);
        res.json({
          success: true,
          data: queueStatus,
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
    "/patient/:patientId/status",
    [
      param("patientId").isUUID().withMessage("Invalid patient ID format"),
      body("status")
        .isIn(["waiting", "next", "consulting", "completed"])
        .withMessage(
          "Status must be one of: waiting, next, consulting, completed"
        ),
      handleValidationErrors,
    ],
    asyncHandler(async (req, res) => {
      const { patientId } = req.params;
      const { status } = req.body;

      try {
        const updatedPatient = await queueManager.updatePatientStatus(
          patientId,
          status
        );
        res.json({
          success: true,
          message: "Patient status updated successfully",
          data: updatedPatient,
        });
      } catch (error) {
        if (error.message.includes("not found")) {
          return res.status(404).json({
            success: false,
            error: "Not Found",
            message: error.message,
          });
        }
        if (error.message.includes("Invalid status")) {
          return res.status(400).json({
            success: false,
            error: "Bad Request",
            message: error.message,
          });
        }
        throw error;
      }
    })
  );

  router.delete(
    "/patient/:patientId",
    [
      param("patientId").isUUID().withMessage("Invalid patient ID format"),
      handleValidationErrors,
    ],
    asyncHandler(async (req, res) => {
      const { patientId } = req.params;

      try {
        const removed = await queueManager.removePatientFromQueue(patientId);
        if (removed) {
          res.json({
            success: true,
            message: "Patient removed from queue successfully",
          });
        } else {
          res.status(404).json({
            success: false,
            error: "Not Found",
            message: "Patient not found",
          });
        }
      } catch (error) {
        throw error;
      }
    })
  );

  router.get(
    "/doctor/:doctorId",
    [
      param("doctorId").trim().notEmpty().withMessage("Doctor ID is required"),
      handleValidationErrors,
    ],
    asyncHandler(async (req, res) => {
      const { doctorId } = req.params;

      try {
        const queue = await queueManager.getDoctorQueue(doctorId);
        const statistics = await queueManager.getQueueStatistics(doctorId);

        res.json({
          success: true,
          data: {
            queue,
            statistics,
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
    "/doctor/:doctorId/statistics",
    [
      param("doctorId").trim().notEmpty().withMessage("Doctor ID is required"),
      handleValidationErrors,
    ],
    asyncHandler(async (req, res) => {
      const { doctorId } = req.params;

      try {
        const statistics = await queueManager.getQueueStatistics(doctorId);
        res.json({
          success: true,
          data: statistics,
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
    "/doctor/:doctorId/estimated-wait-time",
    [
      param("doctorId").trim().notEmpty().withMessage("Doctor ID is required"),
      handleValidationErrors,
    ],
    asyncHandler(async (req, res) => {
      const { doctorId } = req.params;

      try {
        const estimatedWaitTime =
          await queueManager.getEstimatedWaitTimeForNewPatient(doctorId);
        res.json({
          success: true,
          data: {
            doctorId,
            estimatedWaitTime,
            estimatedWaitTimeFormatted: formatWaitTime(estimatedWaitTime),
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

  // just in case it needed for an emergency
  router.delete(
    "/doctor/:doctorId/clear",
    [
      param("doctorId").trim().notEmpty().withMessage("Doctor ID is required"),
      body("confirm")
        .equals("true")
        .withMessage("Confirmation required to clear queue"),
      body("statusFilter")
        .optional()
        .isIn(["waiting", "next", "consulting"])
        .withMessage("Status filter must be one of: waiting, next, consulting"),
      handleValidationErrors,
    ],
    asyncHandler(async (req, res) => {
      const { doctorId } = req.params;
      const { statusFilter = "waiting" } = req.body;

      try {
        const removedCount = await queueManager.clearDoctorQueue(
          doctorId,
          statusFilter
        );
        res.json({
          success: true,
          message: `Queue cleared successfully. Removed ${removedCount} patients.`,
          data: {
            removedCount,
            statusFilter,
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
    "/dashboard/stats",
    asyncHandler(async (req, res) => {
      try {
        const stats = await queueManager.getDashboardStats();
        res.json({
          success: true,
          data: stats,
        });
      } catch (error) {
        throw error;
      }
    })
  );

  router.post(
    "/maintenance/cleanup",
    asyncHandler(async (req, res) => {
      try {
        const removedCount = await queueManager.performMaintenanceCleanup();
        res.json({
          success: true,
          message: `Maintenance cleanup completed. Removed ${removedCount} old records.`,
          data: {
            removedCount,
          },
        });
      } catch (error) {
        throw error;
      }
    })
  );

  router.get(
    "/health",
    asyncHandler(async (req, res) => {
      try {
        const health = await queueManager.getHealthStatus();
        res.json(health);
      } catch (error) {
        res.status(500).json({
          status: "unhealthy",
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    })
  );

  return router;
}

function formatWaitTime(minutes) {
  if (minutes < 60) {
    return `${Math.round(minutes)} minutes`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${Math.round(remainingMinutes)}m`;
}

module.exports = createQueueRoutes;
