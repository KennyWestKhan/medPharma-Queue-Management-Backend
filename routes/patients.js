const express = require("express");
const { validationResult } = require("express-validator");

// Import handlers
const addPatient = require("../handlers/patients/addPatient");
const getPatientDetails = require("../handlers/patients/getPatientDetails");
const getQueueStatus = require("../handlers/patients/getQueueStatus");
const updatePatientStatus = require("../handlers/patients/updatePatientStatus");
const removePatient = require("../handlers/patients/removePatient");
const getPositionHistory = require("../handlers/patients/getPositionHistory");
const getEstimatedCompletion = require("../handlers/patients/getEstimatedCompletion");

// Validation middleware
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

// Async handler wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

const getValidations = (handler) => {
  return handler.validations || [];
};

function createPatientRoutes(queueManager) {
  const router = express.Router();

  /**
   * @swagger
   * /api/queue/add-patient:
   *   post:
   *     tags:
   *       - Queue Management
   *     summary: Add patient to consultation queue
   *     description: |
   *       Adds a new patient to a doctor's consultation queue. The patient will be assigned
   *       a unique ID and placed at the end of the queue based on join time.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreatePatientInput'
   *           example:
   *             name: "John Doe"
   *             doctorId: "doc1"
   *             estimatedDuration: 15
   *     responses:
   *       201:
   *         description: Patient successfully added to queue
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 message:
   *                   type: string
   *                   example: "Patient added to queue successfully"
   *                 data:
   *                   type: object
   *                   properties:
   *                     patient:
   *                       $ref: '#/components/schemas/Patient'
   *                     estimatedWaitTime:
   *                       type: integer
   *                       description: "Estimated wait time in minutes"
   *                       example: 30
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       429:
   *         $ref: '#/components/responses/TooManyRequestsError'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */

  router.post(
    "/add-patient",
    getValidations(addPatient),
    handleValidationErrors,
    asyncHandler(addPatient(queueManager))
  );

  /**
   * @swagger
   * /api/queue/{patientId}:
   *   get:
   *     tags:
   *       - Queue Management
   *     summary: Get patient details
   *     parameters:
   *       - name: patientId
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *         description: Patient unique identifier
   *     responses:
   *       200:
   *         description: Patient details retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Patient'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */

  router.get(
    "/:patientId",
    getValidations(getPatientDetails),
    handleValidationErrors,
    asyncHandler(getPatientDetails(queueManager))
  );

  /**
   * @swagger
   * /api/queue/{patientId}/queue-status:
   *   get:
   *     tags:
   *       - Queue Management
   *     summary: Get patient's queue status
   *     parameters:
   *       - name: patientId
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Queue status retrieved
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 position:
   *                   type: integer
   *                   example: 3
   *                 estimatedWaitTime:
   *                   type: integer
   *                   example: 20
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */

  router.get(
    "/:patientId/queue-status",
    getValidations(getQueueStatus),
    handleValidationErrors,
    asyncHandler(getQueueStatus(queueManager))
  );

  /**
   * @swagger
   * /api/queue/{patientId}/status:
   *   patch:
   *     tags:
   *       - Queue Management
   *     summary: Update patient's queue status
   *     parameters:
   *       - name: patientId
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               status:
   *                 type: string
   *                 enum: [waiting, consulting, completed, late, removed]
   *                 example: consulting
   *               notes:
   *                 type: string
   *                 example: "Patient arrived late but still waiting"
   *     responses:
   *       200:
   *         description: Status updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 message:
   *                   type: string
   *                   example: "Patient status updated"
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */

  router.patch(
    "/:patientId/status",
    getValidations(updatePatientStatus),
    handleValidationErrors,
    asyncHandler(updatePatientStatus(queueManager))
  );

  /**
   * @swagger
   * /api/queue/{patientId}:
   *   delete:
   *     tags:
   *       - Queue Management
   *     summary: Remove patient from queue
   *     parameters:
   *       - name: patientId
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Patient removed from queue
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 message:
   *                   type: string
   *                   example: "Patient removed successfully"
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */

  router.delete(
    "/:patientId",
    getValidations(removePatient),
    handleValidationErrors,
    asyncHandler(removePatient(queueManager))
  );

  /**
   * @swagger
   * /api/queue/{patientId}/position-history:
   *   get:
   *     tags:
   *       - Queue Management
   *     summary: Get patient's queue position history
   *     parameters:
   *       - name: patientId
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Position history retrieved
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 history:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       position:
   *                         type: integer
   *                         example: 5
   *                       timestamp:
   *                         type: string
   *                         format: date-time
   *                         example: "2025-08-31T10:15:30Z"
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */

  router.get(
    "/:patientId/position-history",
    getValidations(getPositionHistory),
    handleValidationErrors,
    asyncHandler(getPositionHistory(queueManager))
  );

  /**
   * @swagger
   * /api/queue/{patientId}/estimated-completion:
   *   get:
   *     tags:
   *       - Queue Management
   *     summary: Get estimated completion time for a patient
   *     parameters:
   *       - name: patientId
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Estimated completion retrieved
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 estimatedCompletionTime:
   *                   type: string
   *                   format: date-time
   *                   example: "2025-08-31T12:00:00Z"
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */

  router.get(
    "/:patientId/estimated-completion",
    getValidations(getEstimatedCompletion),
    handleValidationErrors,
    asyncHandler(getEstimatedCompletion(queueManager))
  );

  return router;
}

module.exports = createPatientRoutes;
