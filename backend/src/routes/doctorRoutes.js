const express = require("express");
const doctorController = require("../controllers/doctorController");
const {
  authenticate,
  authorize,
  ensureApprovedDoctor,
} = require("../middlewares/auth");
const { ROLES } = require("../constants/roles");
const { requireCsrf } = require("../middlewares/csrf");
const { authenticatedWriteLimiter } = require("../middlewares/rateLimits");
const validate = require("../middlewares/validate");
const {
  patientSearchQuerySchema,
  patientParamsSchema,
  assignmentParamsSchema,
  assignmentThresholdsSchema,
  patientDashboardQuerySchema,
  alertQuerySchema,
  alertParamsSchema,
  alertNoteSchema,
  pushSubscriptionSchema,
} = require("../validations/doctorValidation");

const router = express.Router();

router.use(authenticate, authorize(ROLES.DOCTOR), ensureApprovedDoctor);

router.get(
  "/patients",
  validate({ query: patientSearchQuerySchema }),
  doctorController.listAssignedPatients
);
router.post(
  "/push/subscribe",
  authenticatedWriteLimiter,
  requireCsrf,
  validate({ body: pushSubscriptionSchema }),
  doctorController.subscribePush
);
router.delete(
  "/push/subscribe",
  authenticatedWriteLimiter,
  requireCsrf,
  validate({ body: pushSubscriptionSchema.pick({ endpoint: true }) }),
  doctorController.unsubscribePush
);
router.patch(
  "/assignments/:assignmentId/approve",
  authenticatedWriteLimiter,
  requireCsrf,
  validate({ params: assignmentParamsSchema }),
  doctorController.approveAssignment
);
router.patch(
  "/assignments/:assignmentId/deny",
  authenticatedWriteLimiter,
  requireCsrf,
  validate({ params: assignmentParamsSchema }),
  doctorController.denyAssignment
);
router.patch(
  "/assignments/:assignmentId/thresholds",
  authenticatedWriteLimiter,
  requireCsrf,
  validate({ params: assignmentParamsSchema, body: assignmentThresholdsSchema }),
  doctorController.updateAssignmentThresholds
);
router.get(
  "/patients/:patientId/dashboard",
  validate({ params: patientParamsSchema, query: patientDashboardQuerySchema }),
  doctorController.getPatientDashboardForDoctor
);
router.get(
  "/patients/:patientId/readings",
  validate({ params: patientParamsSchema, query: patientDashboardQuerySchema }),
  doctorController.getPatientReadingsForDoctor
);
router.get(
  "/patients/:patientId/alerts",
  validate({ params: patientParamsSchema, query: alertQuerySchema }),
  doctorController.getPatientAlertsForDoctor
);
router.patch(
  "/alerts/:alertId/acknowledge",
  authenticatedWriteLimiter,
  requireCsrf,
  validate({ params: alertParamsSchema }),
  doctorController.acknowledgeAlertAsDoctor
);
router.patch(
  "/alerts/:alertId/note",
  authenticatedWriteLimiter,
  requireCsrf,
  validate({ params: alertParamsSchema, body: alertNoteSchema }),
  doctorController.saveAlertNoteAsDoctor
);

module.exports = router;
