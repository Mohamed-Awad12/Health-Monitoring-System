const express = require("express");
const rateLimit = require("express-rate-limit");
const deviceController = require("../controllers/deviceController");
const validate = require("../middlewares/validate");
const { devicePayloadSchema } = require("../validations/deviceValidation");

const router = express.Router();

const deviceLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post(
  "/data",
  deviceLimiter,
  validate({ body: devicePayloadSchema }),
  deviceController.ingestReading
);

module.exports = router;
