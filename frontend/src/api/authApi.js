import api from "./axios";

export const registerPatient = (payload) =>
  api.post("/auth/register/patient", payload);

export const registerDoctor = (payload) => {
  const formData = new FormData();

  formData.append("name", payload.name);
  formData.append("email", payload.email);
  formData.append("password", payload.password);
  formData.append("specialty", payload.specialty || "");
  formData.append("phone", payload.phone || "");
  formData.append("captchaToken", payload.captchaToken || "");

  if (payload.verificationDocument) {
    formData.append("verificationDocument", payload.verificationDocument);
  }

  return api.post("/auth/register/doctor", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
};

export const login = (payload) => api.post("/auth/login", payload);

export const getCsrfToken = () => api.get("/auth/csrf-token");

export const verifyEmailOtp = (payload) =>
  api.post("/auth/verify-email", payload);

export const resendVerificationOtp = (payload) =>
  api.post("/auth/verify-email/resend", payload);

export const forgotPassword = (payloadOrEmail) => {
  const payload =
    typeof payloadOrEmail === "string"
      ? { email: payloadOrEmail }
      : payloadOrEmail;

  return api.post("/auth/forgot-password", payload);
};

export const resetPassword = (tokenOrPayload, maybePassword) => {
  const payload =
    typeof tokenOrPayload === "string"
      ? { token: tokenOrPayload, password: maybePassword }
      : tokenOrPayload;

  return api.post("/auth/reset-password", payload);
};

export const getCurrentUser = () => api.get("/auth/me");

export const logout = () => api.post("/auth/logout");

export const updateCurrentUserProfile = (payload) =>
  api.patch("/auth/me", payload);

export const changeCurrentUserPassword = (payload) =>
  api.patch("/auth/me/password", payload);

export const deleteCurrentUserAccount = (payload) =>
  api.delete("/auth/me", {
    data: payload,
  });
