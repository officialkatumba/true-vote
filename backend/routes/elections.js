const express = require("express");
const router = express.Router();
const Election = require("../models/Election");

const {
  createElection,
  showCreateElectionForm,
  getElection,
  addCandidateToElection,
  launchElection,
  getElectionResults,
  getMyElections,
  showEditElectionForm,
  updateElection,
  getParticipatedElections,
} = require("../controllers/electionController");

const validate = require("../middlewares/validateRequest");
const { electionValidationSchema } = require("../validators/electionValidator");

const ensureAuthenticated = require("../middlewares/auth");

// ✅ KEEP THIS AT THE TOP BEFORE ANY "/:id" routes
router.get("/participated", ensureAuthenticated, getParticipatedElections);

// Show form to create election (GET)
router.get("/create", ensureAuthenticated, showCreateElectionForm);

// Create election (POST)
router.post(
  "/create",
  ensureAuthenticated,
  validate(electionValidationSchema),
  createElection
);

// View/edit election form
router.get("/:id/edit", ensureAuthenticated, showEditElectionForm);
router.post("/:id/edit", ensureAuthenticated, updateElection);

// Elections created by this candidate
router.get("/my-elections", ensureAuthenticated, getMyElections);

// ✅ ⚠️ This must come after "/participated"
router.get("/:id", getElection);

// Add candidate
router.post("/:id/add-candidate", ensureAuthenticated, addCandidateToElection);

// Launch election
router.post("/:id/launch", ensureAuthenticated, launchElection);

// Results
router.get("/:id/results", ensureAuthenticated, getElectionResults);

// All elections list
router.get("/ongoing", async (req, res) => {
  try {
    const elections = await Election.find().populate("candidates");
    res.render("elections/election-list", { elections });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to load elections", error: err.message });
  }
});

// // Main elections list view
// router.get("/", async (req, res) => {
//   try {
//     const elections = await Election.find().populate("candidates");
//     res.render("elections/index", { elections, user: req.user });
//   } catch (err) {
//     console.error(err);
//     res.status(500).render("error", {
//       title: "Error",
//       errorMessage: "Unable to fetch elections",
//       user: req.user,
//     });
//   }
// });

router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search?.trim() || "";

    const query = {};

    if (search) {
      const numberSearch = parseInt(search);
      if (!isNaN(numberSearch)) {
        query.electionNumber = numberSearch;
      }
    }

    const total = await Election.countDocuments(query);

    const elections = await Election.find(query)
      .sort({ startDate: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("candidates");

    res.render("elections/index", {
      elections,
      user: req.user,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      limit,
      search,
    });
  } catch (err) {
    console.error(err);
    res.status(500).render("error", {
      title: "Error",
      errorMessage: "Unable to fetch elections",
      user: req.user,
    });
  }
});

module.exports = router;
