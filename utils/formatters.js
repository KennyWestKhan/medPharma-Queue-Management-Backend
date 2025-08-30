function formatWaitTime(minutes) {
  if (minutes < 60) {
    return `${Math.round(minutes)} minutes`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${Math.round(remainingMinutes)}m`;
}

module.exports = formatWaitTime;
