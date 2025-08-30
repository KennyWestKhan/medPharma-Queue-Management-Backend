const { param } = require("express-validator");

const getPositionHistory = (queueManager) => async (req, res) => {
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
};

function getStatusEvent(status) {
  const events = {
    waiting: "Added to waiting queue",
    next: "Moved to next in line",
    consulting: "Consultation started",
    completed: "Consultation completed",
  };

  return events[status] || "Status updated";
}

getPositionHistory.validations = [
  param("patientId").isUUID().withMessage("Invalid patient ID format"),
];

module.exports = getPositionHistory;
