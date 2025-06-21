// const express = require("express");
// const router = express.Router();
// // const insightsController = require("../controllers/insightsController");
// const ensureAuthenticated = require("../middlewares/auth");

// const insightsController = require("../controllers/insightsController");

// const {
//   generateReligiousInsight,
// } = require("../controllers/insightsController");

// const { viewInsightPdf } = require("../controllers/insightsController");

// const {
//   generateDemographicInsight,
// } = require("../controllers/insightsController");

// const {
//   generateEducationalInsight,
// } = require("../controllers/insightsController");

// const { generateLivingInsight } = require("../controllers/insightsController");

// const {
//   generateEconomicInsight,
// } = require("../controllers/insightsController");

// const { generatePolicyInsight } = require("../controllers/insightsController");

// const {
//   generateSentimentInsight,
// } = require("../controllers/insightsController");

// router.get(
//   "/:id/report",
//   ensureAuthenticated,
//   insightsController.generateReport
// );

// // 📚 Section-specific insight generation routes
// router.post(
//   "/:id/generate-demographic",
//   insightsController.generateDemographicInsight
// );

// router.post(
//   "/:id/generate-education",
//   ensureAuthenticated,
//   generateEducationalInsight
// );

// router.post("/:id/generate-living", ensureAuthenticated, generateLivingInsight);

// router.post(
//   "/:id/generate-economic",
//   ensureAuthenticated,
//   generateEconomicInsight
// );

// router.post("/:id/generate-policy", ensureAuthenticated, generatePolicyInsight);

// router.get("/view/:filename", viewInsightPdf);

// router.post(
//   "/:id/generate-sentiment",
//   ensureAuthenticated,
//   generateSentimentInsight
// );

// router.post(
//   "/:id/generate-consolidated",
//   ensureAuthenticated,
//   insightsController.generateConsolidatedInsight
// );
// router.post(
//   "/:id/generate-probability",
//   ensureAuthenticated,
//   insightsController.generateVictoryProbability
// );

// router.post(
//   "/:id/generate-religion",
//   ensureAuthenticated,
//   generateReligiousInsight
// );

// module.exports = router;

const express = require("express");
const router = express.Router();
const ensureAuthenticated = require("../middlewares/auth");

const insightsController = require("../controllers/insightsController");

const {
  generateReligiousInsight,
  generateDemographicInsight,
  generateEducationalInsight,
  generateLivingInsight,
  generateEconomicInsight,
  generatePolicyInsight,
  generateSentimentInsight,
  generatePoliticalAffiliationInsight,
  viewInsightPdf,
} = require("../controllers/insightsController");

// Generate full report
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

router.post(
  "/:id/generate-consolidated",
  ensureAuthenticated,
  insightsController.generateConsolidatedInsight
);

router.post(
  "/:id/generate-probability",
  ensureAuthenticated,
  insightsController.generateVictoryProbability
);

router.post(
  "/:id/generate-religion",
  ensureAuthenticated,
  generateReligiousInsight
);

router.post(
  "/:id/generate-political", // ✅ <-- NEW ROUTE
  ensureAuthenticated,
  generatePoliticalAffiliationInsight
);

router.get("/view/:filename", viewInsightPdf);

module.exports = router;
