const express = require("express");
const patientController = require("../controllers/patientController");
const { authenticate, authorize } = require("../middlewares/auth");
const { requireCsrf } = require("../middlewares/csrf");
const { authenticatedWriteLimiter } = require("../middlewares/rateLimits");
const validate = require("../middlewares/validate");
const { ROLES } = require("../constants/roles");
const {
  linkDeviceSchema,
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
