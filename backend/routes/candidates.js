const express = require("express");
const router = express.Router();
const {
  showRegisterCandidateForm,
  registerCandidate,
} = require("../controllers/candidateController");
const {
  candidateValidationSchema,
} = require("../validators/candidateValidator");
const validate = require("../middlewares/validateRequest");
const candidateController = require("../controllers/candidateController");

// Middleware to protect routes
const { ensureAuthenticated } = require("../middlewares/auth");

// GET: Show candidate registration form
router.get("/register", showRegisterCandidateForm);

// POST: Handle candidate registration form submission
router.post(
  "/register",
  validate(candidateValidationSchema),
  registerCandidate
);

// // To:
// router.get("/register-candidate", showRegisterCandidateForm);
// router.post("/register-candidate", registerCandidate);

router.get("/edit", candidateController.showEditCandidateForm);
router.post("/edit", candidateController.updateCandidate);

// GET: Candidate Dashboard (only accessible if logged in and role is "candidate")
router.get("/dashboard", (req, res) => {
  if (req.user.role !== "candidate") {
    return res.status(403).send("Access denied.");
  }

  res.render("candidate-dashboard", {
    user: req.user,
  });
});

module.exports = router;
