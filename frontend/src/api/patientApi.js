import api from "./axios";

export const getDoctors = (params = {}) =>
  api.get("/patients/doctors", { params });
export const linkDevice = (payload) => api.patch("/patients/device/link", payload);
export const assignDoctor = (payload) =>
  api.post("/patients/doctor-assignment", payload);
export const unassignDoctor = (assignmentId) =>
  api.patch(`/patients/doctor-assignment/${assignmentId}/unassign`);
export const getPatientDashboard = (range) =>
  api.get("/patients/dashboard", { params: { range } });
export const getPatientReadings = (range) =>
  api.get("/patients/readings", { params: { range } });
export const getPatientAlerts = (status = "all") =>
  api.get("/patients/alerts", { params: { status } });
export const acknowledgePatientAlert = (alertId) =>
  api.patch(`/patients/alerts/${alertId}/acknowledge`);
export const downloadPatientReport = (range, format) =>
  api.get("/patients/reports", {
    params: { range, format },
    responseType: "blob",
  });

export const generatePatientAssistantReport = (payload) =>
  api.post("/patients/assistant/report", payload);
