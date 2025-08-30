const getHealthStatus = (queueManager) => async (req, res) => {
  const health = await queueManager.getHealthStatus();
  res.json(health);
};

module.exports = getHealthStatus;
