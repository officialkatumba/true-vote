const express = require("express");
const router = express.Router();
const insightsController = require("../controllers/insightsController");
const ensureAuthenticated = require("../middlewares/auth");

const {
  generateDemographicInsight,
} = require("../controllers/insightsController");

const {
  generateEducationalInsight,
} = require("../controllers/insightsController");

const { generateLivingInsight } = require("../controllers/insightsController");

const {
  generateEconomicInsight,
} = require("../controllers/insightsController");

const { generatePolicyInsight } = require("../controllers/insightsController");

const {
  generateSentimentInsight,
} = require("../controllers/insightsController");

router.get(
  "/:id/report",
  ensureAuthenticated,
  insightsController.generateReport
);

// 📚 Section-specific insight generation routes
router.post(
  "/:id/generate-demographic",
  insightsController.generateDemographicInsight
);

router.post(
  "/:id/generate-education",
  ensureAuthenticated,
  generateEducationalInsight
);

router.post("/:id/generate-living", ensureAuthenticated, generateLivingInsight);

router.post(
  "/:id/generate-economic",
  ensureAuthenticated,
  generateEconomicInsight
);

router.post("/:id/generate-policy", ensureAuthenticated, generatePolicyInsight);

router.post(
  "/:id/generate-sentiment",
  ensureAuthenticated,
  generateSentimentInsight
);

module.exports = router;
