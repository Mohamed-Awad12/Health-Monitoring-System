const express = require("express");
const doctorController = require("../controllers/doctorController");
const {
  authenticate,
  authorize,
  ensureApprovedDoctor,
} = require("../middlewares/auth");
const { ROLES } = require("../constants/roles");
const validate = require("../middlewares/validate");
const {
  patientSearchQuerySchema,
  patientParamsSchema,
  assignmentParamsSchema,
  patientDashboardQuerySchema,
  alertQuerySchema,
  alertParamsSchema,
} = require("../validations/doctorValidation");

const router = express.Router();

router.use(authenticate, authorize(ROLES.DOCTOR), ensureApprovedDoctor);

router.get(
  "/patients",
  validate({ query: patientSearchQuerySchema }),
  doctorController.listAssignedPatients
);
router.patch(
  "/assignments/:assignmentId/approve",
  validate({ params: assignmentParamsSchema }),
  doctorController.approveAssignment
);
router.patch(
  "/assignments/:assignmentId/deny",
  validate({ params: assignmentParamsSchema }),
  doctorController.denyAssignment
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
  validate({ params: alertParamsSchema }),
  doctorController.acknowledgeAlertAsDoctor
);

module.exports = router;
