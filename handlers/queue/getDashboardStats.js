const getDashboardStats = (queueManager) => async (req, res) => {
  const stats = await queueManager.getDashboardStats();
  res.json({
    success: true,
    data: stats,
  });
};

module.exports = getDashboardStats;
