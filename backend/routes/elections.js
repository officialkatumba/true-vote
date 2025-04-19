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
} = require("../controllers/electionController");

const ensureAuthenticated = require("../middlewares/auth"); // Optional for route protection

// Show form to create election (GET)
router.get("/create", ensureAuthenticated, showCreateElectionForm);

// Create election (POST)
router.post("/create", ensureAuthenticated, createElection);

//Viewing the form to edit an election
router.get("/:id/edit", ensureAuthenticated, showEditElectionForm);

// Handl;ing the editing of an election
router.post("/:id/edit", ensureAuthenticated, updateElection);

// Viewing a list of All elections by a candidate
router.get("/my-elections", ensureAuthenticated, getMyElections);

// Get election by ID (GET)
// router.get("/:id", ensureAuthenticated, getElection); Removed ensureAuthenticated
// to allow voters view this page as well as other candidates so thath they can login
router.get("/:id", getElection);

// Add a candidate to an election (POST)
router.post("/:id/add-candidate", ensureAuthenticated, addCandidateToElection);

// Launch an election (POST)
router.post("/:id/launch", ensureAuthenticated, launchElection);

// View results (GET)
router.get("/:id/results", ensureAuthenticated, getElectionResults);

//Viewing of All elections

router.get("/ongoing", async (req, res) => {
  try {
    const elections = await Election.find({
      // electionStatus: "ongoing",
    }).populate("candidates");
    res.render("elections/election-list", { elections });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Failed to load elections", error: err.message });
  }
});

// Show all elections (EJS view)

router.get("/", async (req, res) => {
  try {
    const elections = await Election.find().populate("candidates");
    res.render("elections/index", { elections, user: req.user });
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
