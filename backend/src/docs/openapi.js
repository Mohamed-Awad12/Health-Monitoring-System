const bearerAuth = [{ bearerAuth: [] }, { cookieAuth: [] }];

const idParam = (name) => ({
  name,
  in: "path",
  required: true,
  schema: { type: "string", pattern: "^[0-9a-fA-F]{24}$" },
});

const jsonResponse = (description, schema = { type: "object" }) => ({
  description,
  content: {
    "application/json": {
      schema,
    },
  },
});

const messageResponse = jsonResponse("Message response", {
  type: "object",
  properties: {
    message: { type: "string" },
  },
});

const userSchema = {
  type: "object",
  properties: {
    _id: { type: "string" },
    name: { type: "string" },
    email: { type: "string", format: "email" },
    role: { type: "string", enum: ["patient", "doctor", "admin"] },
    phone: { type: "string", nullable: true },
    specialty: { type: "string", nullable: true },
    emailVerified: { type: "boolean" },
    twoFactorEnabled: { type: "boolean" },
    doctorVerification: { type: "object" },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
};

const sessionSchema = {
  type: "object",
  properties: {
    message: { type: "string" },
    token: { type: "string" },
    csrfToken: { type: "string" },
    user: userSchema,
    emailVerification: { type: "object" },
  },
};

const alertSchema = {
  type: "object",
  properties: {
    _id: { type: "string" },
    patient: { type: "string" },
    reading: { type: "string" },
    type: { type: "string", enum: ["spo2_low", "bpm_low", "bpm_high"] },
    severity: { type: "string", enum: ["warning", "critical"] },
    message: { type: "string" },
    metrics: {
      type: "object",
      properties: {
        spo2: { type: "number" },
        bpm: { type: "number" },
      },
    },
    status: { type: "string", enum: ["open", "acknowledged"] },
    doctorNote: { type: "string", nullable: true },
    notedAt: { type: "string", format: "date-time", nullable: true },
    createdAt: { type: "string", format: "date-time" },
  },
};

const pushSubscriptionSchema = {
  type: "object",
  required: ["endpoint", "keys"],
  properties: {
    endpoint: { type: "string", format: "uri" },
    keys: {
      type: "object",
      required: ["auth", "p256dh"],
      properties: {
        auth: { type: "string" },
        p256dh: { type: "string" },
      },
    },
  },
};

const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "Pulse Oximeter API",
    version: "1.0.0",
    description: "API for Pulse/iHealth patient, doctor, admin, and device workflows.",
  },
  servers: [{ url: "/api" }],
  tags: [
    { name: "Health" },
    { name: "Auth" },
    { name: "Admin" },
    { name: "Patient" },
    { name: "Doctor" },
    { name: "Device" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      cookieAuth: { type: "apiKey", in: "cookie", name: "pulse_session" },
      csrfHeader: { type: "apiKey", in: "header", name: "x-csrf-token" },
    },
    schemas: {
      User: userSchema,
      Alert: alertSchema,
      Session: sessionSchema,
      PushSubscription: pushSubscriptionSchema,
      Error: {
        type: "object",
        properties: {
          message: { type: "string" },
          requestId: { type: "string" },
          details: {},
        },
      },
    },
  },
  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        responses: {
          200: jsonResponse("Health status"),
        },
      },
    },
    "/metrics": {
      get: {
        tags: ["Health"],
        security: bearerAuth,
        responses: {
          200: jsonResponse("Metrics snapshot"),
          403: jsonResponse("Admin access required"),
        },
      },
    },
    "/auth/csrf-token": {
      get: {
        tags: ["Auth"],
        responses: { 200: jsonResponse("CSRF token") },
      },
    },
    "/auth/register/patient": {
      post: {
        tags: ["Auth"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "email", "password", "captchaToken"],
                properties: {
                  name: { type: "string", minLength: 2, maxLength: 80 },
                  email: { type: "string", format: "email" },
                  password: { type: "string", minLength: 8, maxLength: 128 },
                  phone: { type: "string", maxLength: 25 },
                  captchaToken: { type: "string" },
                },
              },
            },
          },
        },
        responses: { 201: jsonResponse("Patient registered") },
      },
    },
    "/auth/register/doctor": {
      post: {
        tags: ["Auth"],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["name", "email", "password", "specialty", "captchaToken", "verificationDocument"],
                properties: {
                  name: { type: "string" },
                  email: { type: "string", format: "email" },
                  password: { type: "string" },
                  specialty: { type: "string" },
                  phone: { type: "string" },
                  captchaToken: { type: "string" },
                  verificationDocument: { type: "string", format: "binary" },
                },
              },
            },
          },
        },
        responses: { 201: jsonResponse("Doctor registered") },
      },
    },
    "/auth/register/admin/bootstrap": {
      post: {
        tags: ["Auth"],
        parameters: [{ name: "x-admin-bootstrap-token", in: "header", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
        responses: { 201: jsonResponse("Admin registered", sessionSchema) },
      },
    },
    "/auth/login": {
      post: {
        tags: ["Auth"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password", "captchaToken"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string" },
                  captchaToken: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: jsonResponse("Session or two-factor challenge", {
            oneOf: [
              sessionSchema,
              {
                type: "object",
                properties: {
                  requiresTwoFactor: { type: "boolean" },
                  tempToken: { type: "string" },
                },
              },
            ],
          }),
        },
      },
    },
    "/auth/refresh": {
      post: {
        tags: ["Auth"],
        security: [{ csrfHeader: [] }],
        requestBody: { content: { "application/json": { schema: { type: "object" } } } },
        responses: { 200: jsonResponse("Session refreshed", sessionSchema) },
      },
    },
    "/auth/2fa/verify": {
      post: {
        tags: ["Auth"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["tempToken", "otp", "captchaToken"],
                properties: {
                  tempToken: { type: "string" },
                  otp: { type: "string", pattern: "^\\d{6}$" },
                  captchaToken: { type: "string" },
                },
              },
            },
          },
        },
        responses: { 200: jsonResponse("Two-factor verified", sessionSchema) },
      },
    },
    "/auth/verify-email": {
      post: {
        tags: ["Auth"],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
        responses: { 200: messageResponse },
      },
    },
    "/auth/verify-email/resend": {
      post: {
        tags: ["Auth"],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
        responses: { 200: messageResponse },
      },
    },
    "/auth/forgot-password": {
      post: {
        tags: ["Auth"],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
        responses: { 200: messageResponse },
      },
    },
    "/auth/reset-password": {
      post: {
        tags: ["Auth"],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
        responses: { 200: messageResponse },
      },
    },
    "/auth/me": {
      get: { tags: ["Auth"], security: bearerAuth, responses: { 200: jsonResponse("Current user", { type: "object", properties: { user: userSchema } }) } },
      patch: { tags: ["Auth"], security: bearerAuth, requestBody: { content: { "application/json": { schema: { type: "object" } } } }, responses: { 200: jsonResponse("Profile updated") } },
      delete: { tags: ["Auth"], security: bearerAuth, requestBody: { content: { "application/json": { schema: { type: "object" } } } }, responses: { 200: messageResponse } },
    },
    "/auth/me/password": {
      patch: { tags: ["Auth"], security: bearerAuth, requestBody: { content: { "application/json": { schema: { type: "object" } } } }, responses: { 200: jsonResponse("Password changed") } },
    },
    "/auth/me/2fa": {
      patch: { tags: ["Auth"], security: bearerAuth, requestBody: { content: { "application/json": { schema: { type: "object", properties: { enabled: { type: "boolean" } } } } } }, responses: { 200: jsonResponse("Two-factor preference updated") } },
    },
    "/auth/logout": {
      post: { tags: ["Auth"], security: bearerAuth, responses: { 200: messageResponse } },
    },
    "/admin/users": {
      get: { tags: ["Admin"], security: bearerAuth, parameters: [
        { name: "search", in: "query", schema: { type: "string" } },
        { name: "role", in: "query", schema: { type: "string" } },
        { name: "doctorVerificationStatus", in: "query", schema: { type: "string" } },
        { name: "cursor", in: "query", schema: { type: "string" } },
        { name: "limit", in: "query", schema: { type: "integer", maximum: 100 } },
      ], responses: { 200: jsonResponse("Admin user list") } },
      post: { tags: ["Admin"], security: bearerAuth, requestBody: { content: { "application/json": { schema: { type: "object" } } } }, responses: { 201: jsonResponse("User created") } },
    },
    "/admin/users/{userId}": {
      get: { tags: ["Admin"], security: bearerAuth, parameters: [idParam("userId")], responses: { 200: jsonResponse("User") } },
      patch: { tags: ["Admin"], security: bearerAuth, parameters: [idParam("userId")], requestBody: { content: { "application/json": { schema: { type: "object" } } } }, responses: { 200: jsonResponse("User updated") } },
      delete: { tags: ["Admin"], security: bearerAuth, parameters: [idParam("userId")], responses: { 200: messageResponse } },
    },
    "/admin/users/{userId}/doctor-verification/document": {
      get: { tags: ["Admin"], security: bearerAuth, parameters: [idParam("userId")], responses: { 200: { description: "Doctor verification document" } } },
    },
    "/admin/users/{userId}/doctor-verification": {
      patch: { tags: ["Admin"], security: bearerAuth, parameters: [idParam("userId")], requestBody: { content: { "application/json": { schema: { type: "object" } } } }, responses: { 200: jsonResponse("Doctor verification reviewed") } },
    },
    "/admin/users/{userId}/send-verification": {
      post: { tags: ["Admin"], security: bearerAuth, parameters: [idParam("userId")], responses: { 200: messageResponse } },
    },
    "/patients/doctors": {
      get: { tags: ["Patient"], security: bearerAuth, parameters: [
        { name: "search", in: "query", schema: { type: "string" } },
        { name: "page", in: "query", schema: { type: "integer" } },
        { name: "limit", in: "query", schema: { type: "integer" } },
      ], responses: { 200: jsonResponse("Doctor directory") } },
    },
    "/patients/device/link": {
      patch: { tags: ["Patient"], security: bearerAuth, requestBody: { content: { "application/json": { schema: { type: "object" } } } }, responses: { 200: jsonResponse("Device linked") } },
    },
    "/patients/device/rotate-secret": {
      post: { tags: ["Patient"], security: bearerAuth, responses: { 200: jsonResponse("Device secret rotated") } },
    },
    "/patients/push/subscribe": {
      post: { tags: ["Patient"], security: bearerAuth, requestBody: { content: { "application/json": { schema: pushSubscriptionSchema } } }, responses: { 201: messageResponse } },
      delete: { tags: ["Patient"], security: bearerAuth, requestBody: { content: { "application/json": { schema: { type: "object", properties: { endpoint: { type: "string", format: "uri" } } } } } }, responses: { 200: messageResponse } },
    },
    "/patients/doctor-assignment": {
      post: { tags: ["Patient"], security: bearerAuth, requestBody: { content: { "application/json": { schema: { type: "object", properties: { doctorId: { type: "string" } } } } } }, responses: { 200: jsonResponse("Assignment requested") } },
    },
    "/patients/doctor-assignment/{assignmentId}/unassign": {
      patch: { tags: ["Patient"], security: bearerAuth, parameters: [idParam("assignmentId")], responses: { 200: jsonResponse("Assignment ended") } },
    },
    "/patients/dashboard": {
      get: { tags: ["Patient"], security: bearerAuth, parameters: [{ name: "range", in: "query", schema: { type: "string", enum: ["day", "week", "month"] } }], responses: { 200: jsonResponse("Patient dashboard") } },
    },
    "/patients/readings": {
      get: { tags: ["Patient"], security: bearerAuth, parameters: [{ name: "range", in: "query", schema: { type: "string" } }], responses: { 200: jsonResponse("Reading feed") } },
    },
    "/patients/alerts": {
      get: { tags: ["Patient"], security: bearerAuth, parameters: [{ name: "status", in: "query", schema: { type: "string" } }], responses: { 200: jsonResponse("Alerts", { type: "object", properties: { alerts: { type: "array", items: alertSchema } } }) } },
    },
    "/patients/alerts/{alertId}/acknowledge": {
      patch: { tags: ["Patient"], security: bearerAuth, parameters: [idParam("alertId")], responses: { 200: jsonResponse("Alert acknowledged") } },
    },
    "/patients/reports": {
      get: { tags: ["Patient"], security: bearerAuth, parameters: [
        { name: "range", in: "query", schema: { type: "string" } },
        { name: "format", in: "query", schema: { type: "string", enum: ["csv", "pdf"] } },
      ], responses: { 200: { description: "CSV or PDF report" } } },
    },
    "/patients/assistant/report": {
      post: { tags: ["Patient"], security: bearerAuth, requestBody: { content: { "application/json": { schema: { type: "object" } } } }, responses: { 200: jsonResponse("Assistant report") } },
    },
    "/doctors/patients": {
      get: { tags: ["Doctor"], security: bearerAuth, parameters: [{ name: "search", in: "query", schema: { type: "string" } }], responses: { 200: jsonResponse("Assigned patients") } },
    },
    "/doctors/push/subscribe": {
      post: { tags: ["Doctor"], security: bearerAuth, requestBody: { content: { "application/json": { schema: pushSubscriptionSchema } } }, responses: { 201: messageResponse } },
      delete: { tags: ["Doctor"], security: bearerAuth, requestBody: { content: { "application/json": { schema: { type: "object", properties: { endpoint: { type: "string", format: "uri" } } } } } }, responses: { 200: messageResponse } },
    },
    "/doctors/assignments/{assignmentId}/approve": {
      patch: { tags: ["Doctor"], security: bearerAuth, parameters: [idParam("assignmentId")], responses: { 200: jsonResponse("Assignment approved") } },
    },
    "/doctors/assignments/{assignmentId}/deny": {
      patch: { tags: ["Doctor"], security: bearerAuth, parameters: [idParam("assignmentId")], responses: { 200: jsonResponse("Assignment denied") } },
    },
    "/doctors/assignments/{assignmentId}/thresholds": {
      patch: { tags: ["Doctor"], security: bearerAuth, parameters: [idParam("assignmentId")], requestBody: { content: { "application/json": { schema: { type: "object", properties: { lowSpo2: { type: ["number", "null"] }, lowBpm: { type: ["number", "null"] }, highBpm: { type: ["number", "null"] } } } } } }, responses: { 200: jsonResponse("Thresholds updated") } },
    },
    "/doctors/patients/{patientId}/dashboard": {
      get: { tags: ["Doctor"], security: bearerAuth, parameters: [idParam("patientId"), { name: "range", in: "query", schema: { type: "string" } }], responses: { 200: jsonResponse("Patient dashboard") } },
    },
    "/doctors/patients/{patientId}/readings": {
      get: { tags: ["Doctor"], security: bearerAuth, parameters: [idParam("patientId"), { name: "range", in: "query", schema: { type: "string" } }], responses: { 200: jsonResponse("Reading feed") } },
    },
    "/doctors/patients/{patientId}/alerts": {
      get: { tags: ["Doctor"], security: bearerAuth, parameters: [idParam("patientId"), { name: "status", in: "query", schema: { type: "string" } }], responses: { 200: jsonResponse("Alerts") } },
    },
    "/doctors/alerts/{alertId}/acknowledge": {
      patch: { tags: ["Doctor"], security: bearerAuth, parameters: [idParam("alertId")], responses: { 200: jsonResponse("Alert acknowledged") } },
    },
    "/doctors/alerts/{alertId}/note": {
      patch: { tags: ["Doctor"], security: bearerAuth, parameters: [idParam("alertId")], requestBody: { content: { "application/json": { schema: { type: "object", properties: { note: { type: ["string", "null"], maxLength: 500 } } } } } }, responses: { 200: jsonResponse("Alert note saved") } },
    },
    "/device/data": {
      post: {
        tags: ["Device"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["deviceSecretId", "spo2", "bpm"],
                properties: {
                  deviceSecretId: { type: "string" },
                  spo2: { type: "number", minimum: 0, maximum: 100 },
                  bpm: { type: "number", minimum: 0, maximum: 250 },
                  timestamp: { type: "string", format: "date-time" },
                },
              },
            },
          },
        },
        responses: { 201: jsonResponse("Reading stored") },
      },
    },
  },
};

module.exports = openApiSpec;
