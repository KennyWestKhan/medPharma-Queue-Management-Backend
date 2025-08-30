/**
 * Calculate the waiting time in minutes from a given join time
 * @param {string} joinedAt - ISO string timestamp when the patient joined
 * @returns {number} waiting time in minutes
 */
function calculateWaitingTime(joinedAt) {
  const now = new Date();
  const diffInMinutes = Math.floor(
    (now.getTime() - new Date(joinedAt).getTime()) / (1000 * 60)
  );
  return Math.max(0, diffInMinutes);
}

module.exports = calculateWaitingTime;
