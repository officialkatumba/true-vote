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
const Candidate = require("../models/Candidate");

// ✅ Make sure the path is correct (adjust if needed)
// const candidatesController = require("../controllers/candidatesController");

// Middleware to protect routes
const { ensureAuthenticated } = require("../middlewares/auth");

// Get All candidates

router.get("/", candidateController.getAllCandidates);

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

// // Candidate profile view by ID
// router.get("/:id", async (req, res) => {
//   try {
//     const candidate = await Candidate.findById(req.params.id).populate(
//       "elections invitedElections user"
//     );
//     if (!candidate) {
//       return res.status(404).render("404", { message: "Candidate not found" });
//     }

//     res.render("candidates/candidateByAdmin", { candidate }); // Render candidate profile
//   } catch (err) {
//     console.error(err);
//     res.status(500).render("500", { message: "Server error" });
//   }
// });

// Admin view for a single candidate
router.get("/:id", async (req, res) => {
  try {
    // First, find the candidate by ID and populate the linked user
    const candidate = await Candidate.findById(req.params.id).populate("user");

    if (!candidate) {
      return res.status(404).send("Candidate not found");
    }

    // res.render("candidates/candidateByAdmin", { candidate });
    res.render("candidates/candidateByAdmin", {
      candidate,
      user: candidate.user, // pass actual user
    });
  } catch (err) {
    console.error("Error fetching candidate:", err);
    res.status(500).render("500", { message: "Server Error" });
  }
});

router.post("/:id/activate-membership", candidateController.activateMembership);

// Show edit membership form
router.get(
  "/:id/edit-membership",

  candidateController.showEditMembershipForm
);

// Handle update
router.post(
  "/:id/update-membership",

  candidateController.updateMembership
);

module.exports = router;
