const express = require("express");
const router = express.Router();
const insightsController = require("../controllers/insightsController");
const ensureAuthenticated = require("../middlewares/auth");

// GET /insights/:id/report - AI-powered insights for a specific election
router.get(
  "/insights/:id/report",
  ensureAuthenticated,
  insightsController.generateReport
);

router.post(
  "/insights/:id/generate",
  ensureAuthenticated,
  insightsController.generateAllInsightsForCandidate
);

module.exports = router;
