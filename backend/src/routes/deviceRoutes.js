const express = require("express");
const deviceController = require("../controllers/deviceController");
const { deviceIngestLimiter } = require("../middlewares/rateLimits");
const validate = require("../middlewares/validate");
const { devicePayloadSchema } = require("../validations/deviceValidation");

const router = express.Router();

router.post(
  "/data",
  deviceIngestLimiter,
  validate({ body: devicePayloadSchema }),
  deviceController.ingestReading
);

module.exports = router;
