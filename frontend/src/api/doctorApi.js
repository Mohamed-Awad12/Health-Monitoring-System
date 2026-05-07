import api from "./axios";

export const getAssignedPatients = (search = "") =>
  api.get("/doctors/patients", { params: { search } });

export const getDoctorPatientDashboard = (patientId, range) =>
  api.get(`/doctors/patients/${patientId}/dashboard`, {
    params: { range },
  });

export const getDoctorPatientReadings = (patientId, range) =>
  api.get(`/doctors/patients/${patientId}/readings`, {
    params: { range },
  });

export const getDoctorPatientAlerts = (patientId, status = "all") =>
  api.get(`/doctors/patients/${patientId}/alerts`, {
    params: { status },
  });

export const acknowledgeDoctorAlert = (alertId) =>
  api.patch(`/doctors/alerts/${alertId}/acknowledge`);

export const saveDoctorAlertNote = (alertId, payload) =>
  api.patch(`/doctors/alerts/${alertId}/note`, payload);

export const approveDoctorAssignment = (assignmentId) =>
  api.patch(`/doctors/assignments/${assignmentId}/approve`);

export const denyDoctorAssignment = (assignmentId) =>
  api.patch(`/doctors/assignments/${assignmentId}/deny`);

export const updateDoctorAssignmentThresholds = (assignmentId, payload) =>
  api.patch(`/doctors/assignments/${assignmentId}/thresholds`, payload);
