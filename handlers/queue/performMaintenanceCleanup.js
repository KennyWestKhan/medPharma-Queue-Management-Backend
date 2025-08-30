const performMaintenanceCleanup = (queueManager) => async (req, res) => {
  const removedCount = await queueManager.performMaintenanceCleanup();
  res.json({
    success: true,
    message: `Maintenance cleanup completed. Removed ${removedCount} old records.`,
    data: {
      removedCount,
    },
  });
};

module.exports = performMaintenanceCleanup;
