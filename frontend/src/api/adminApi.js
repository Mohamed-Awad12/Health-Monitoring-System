import api from "./axios";

export const getAdminUsers = (params = {}) => api.get("/admin/users", { params });

export const createAdminUser = (payload) => api.post("/admin/users", payload);

export const updateAdminUser = (userId, payload) =>
  api.patch(`/admin/users/${userId}`, payload);

export const deleteAdminUser = (userId) => api.delete(`/admin/users/${userId}`);

export const reviewDoctorVerification = (userId, payload) =>
  api.patch(`/admin/users/${userId}/doctor-verification`, payload);

export const sendUserVerificationEmail = (userId) =>
  api.post(`/admin/users/${userId}/send-verification`);

export const getDoctorVerificationDocument = (userId) =>
  api.get(`/admin/users/${userId}/doctor-verification/document`, {
    responseType: "blob",
  });
