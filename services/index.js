export function setRoomId(id) {
  return `doctor_${id}`;
}

export function getDoctorPatientRoom(doctorId, patientId) {
  return `doctor:${doctorId}:patient:${patientId}`;
}

export function getDoctorRoom(doctorId) {
  return `doctor:${doctorId}`;
}

export function getPatientPrivateRoom(patientId) {
  return `patient:${patientId}`;
}
