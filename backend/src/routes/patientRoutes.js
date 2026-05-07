const express = require("express");
const patientController = require("../controllers/patientController");
const { authenticate, authorize } = require("../middlewares/auth");
const { requireCsrf } = require("../middlewares/csrf");
const { authenticatedWriteLimiter } = require("../middlewares/rateLimits");
const validate = require("../middlewares/validate");
const { ROLES } = require("../constants/roles");
const {
  linkDeviceSchema,
  rotateDeviceSecretSchema,
  pushSubscriptionSchema,
  assignDoctorSchema,
  doctorListQuerySchema,
  patientDashboardQuerySchema,
  alertQuerySchema,
  reportQuerySchema,
  assistantReportSchema,
  alertParamsSchema,
  assignmentParamsSchema,
} = require("../validations/patientValidation");

const router = express.Router();

router.use(authenticate, authorize(ROLES.PATIENT));

router.get(
  "/doctors",
  validate({ query: doctorListQuerySchema }),
  patientController.listDoctors
);
router.patch(
  "/device/link",
  authenticatedWriteLimiter,
  requireCsrf,
  validate({ body: linkDeviceSchema }),
  patientController.linkDevice
);
router.post(
  "/device/rotate-secret",
  authenticatedWriteLimiter,
  requireCsrf,
  validate({ body: rotateDeviceSecretSchema }),
  patientController.rotateDeviceSecret
);
router.post(
  "/push/subscribe",
  authenticatedWriteLimiter,
  requireCsrf,
  validate({ body: pushSubscriptionSchema }),
  patientController.subscribePush
);
router.delete(
  "/push/subscribe",
  authenticatedWriteLimiter,
  requireCsrf,
  validate({ body: pushSubscriptionSchema.pick({ endpoint: true }) }),
  patientController.unsubscribePush
);
router.post(
  "/doctor-assignment",
  authenticatedWriteLimiter,
  requireCsrf,
  validate({ body: assignDoctorSchema }),
  patientController.assignDoctor
);
router.patch(
  "/doctor-assignment/:assignmentId/unassign",
  authenticatedWriteLimiter,
  requireCsrf,
  validate({ params: assignmentParamsSchema }),
  patientController.unassignDoctor
);
router.get(
  "/dashboard",
  validate({ query: patientDashboardQuerySchema }),
  patientController.getDashboard
);
router.get(
  "/readings",
  validate({ query: patientDashboardQuerySchema }),
  patientController.getReadings
);
router.get(
  "/alerts",
  validate({ query: alertQuerySchema }),
  patientController.getAlerts
);
router.patch(
  "/alerts/:alertId/acknowledge",
  authenticatedWriteLimiter,
  requireCsrf,
  validate({ params: alertParamsSchema }),
  patientController.acknowledgeAlert
);
router.get(
  "/reports",
  validate({ query: reportQuerySchema }),
  patientController.downloadReport
);
router.post(
  "/assistant/report",
  authenticatedWriteLimiter,
  requireCsrf,
  validate({ body: assistantReportSchema }),
  patientController.generateAssistantReport
);

module.exports = router;
