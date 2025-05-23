const express = require("express");
const router = express.Router();
const Election = require("../models/Election");
const { castVote, getResults } = require("../controllers/voteController");
const {
  getRejectForm,
  submitRejection,
} = require("../controllers/rejectionController");

const validateRequest = require("../middlewares/validateRequest");
const { voteValidationSchema } = require("../validators/voteValidationSchema");

const rejectionValidationSchema = require("../validators/rejectionValidationSchema");
//Display the voting form

router.get("/:electionId/vote/:candidateId", async (req, res) => {
  const { electionId, candidateId } = req.params;
  res.render("vote/vote-form", { electionId, candidateId });
});

router.post("/cast", validateRequest(voteValidationSchema), castVote); // POST /api/votes/cast

// Fetch Election Results
router.get("/:id/results", getResults);

// Show rejection form
router.get("/:electionId/reject", getRejectForm);

// Handle submission
router.post(
  "/:electionId/reject",
  validateRequest(rejectionValidationSchema),
  submitRejection
);

//Thank you page to display  after success vote
router.get("/thank-you", (req, res) => {
  const { voucherNumber } = req.query;
  res.render("vote/thank-you", { voucherNumber });
});

module.exports = router;
