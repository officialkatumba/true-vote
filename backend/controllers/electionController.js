const Election = require("../models/Election");
const Candidate = require("../models/Candidate");
const User = require("../models/User");
const Vote = require("../models/Vote");

// GET /elections/create – Show form to call an election
exports.showCreateElectionForm = (req, res) => {
  res.render("elections/create"); // EJS form (to be created)
};

// POST /elections/create – Create election and link creator
exports.createElection = async (req, res) => {
  try {
    const { type, startDate, endDate } = req.body;
    const creatorId = req.user.candidate._id; // from ensureAuthenticated & Passport

    const newElection = new Election({
      type,
      startDate,
      endDate,
      createdBy: creatorId,
      candidates: [creatorId],
    });

    await newElection.save();

    res.redirect(`/api/elections/${newElection._id}`);
  } catch (error) {
    console.error(error);
    res.status(500).render("error", {
      errorMessage: "Failed to create election",
    });
  }
};

// Showing the edit form for an election

exports.showEditElectionForm = async (req, res) => {
  try {
    const election = await Election.findById(req.params.id);

    if (!election || election.electionStatus !== "draft") {
      return res.status(403).render("error", {
        errorMessage: "Only draft elections can be edited",
      });
    }

    // Only creator can edit
    if (!election.createdBy.equals(req.user.candidate._id)) {
      return res.status(403).render("error", {
        errorMessage: "You are not authorized to edit this election",
      });
    }

    res.render("elections/edit", { election });
  } catch (error) {
    console.error(error);
    res.status(500).render("error", {
      errorMessage: "Error loading election for editing",
    });
  }
};

// Handling the form to edit an election

exports.updateElection = async (req, res) => {
  try {
    const { type, startDate, endDate } = req.body;
    const election = await Election.findById(req.params.id);

    if (!election || election.electionStatus !== "draft") {
      return res.status(403).render("error", {
        errorMessage: "Only draft elections can be edited",
      });
    }

    // Ensure only the creator can edit
    if (!election.createdBy.equals(req.user.candidate._id)) {
      return res.status(403).render("error", {
        errorMessage: "You are not authorized to edit this election",
      });
    }

    election.type = type;
    election.startDate = new Date(startDate);
    election.endDate = new Date(endDate);
    await election.save();

    res.redirect(`/api/elections/${election._id}`);
  } catch (error) {
    console.error(error);
    res.status(500).render("error", {
      errorMessage: "Error updating election",
    });
  }
};

// GET /elections/my-elections - View all elections called by the current candidate
exports.getMyElections = async (req, res) => {
  try {
    const candidateId = req.user.candidate._id;

    const elections = await Election.find({ createdBy: candidateId })
      .sort({ startDate: -1 }) // Sort by newest first
      .populate("candidates"); // Populate candidate details if needed

    res.render("elections/myElections", {
      elections,
      currentDate: new Date(), // Pass current date for status comparison
    });
  } catch (error) {
    console.error(error);
    res.status(500).render("error", {
      errorMessage: "Error loading your elections",
    });
  }
};

// // // GET /elections/:id – View election details

// exports.getElection = async (req, res) => {
//   try {
//     const election = await Election.findById(req.params.id)
//       .populate("candidates")
//       .populate("createdBy");

//     if (!election) {
//       return res.status(404).render("error", {
//         errorMessage: "Election not found",
//         user: req.user,
//       });
//     }

//     let populatedUser = null;
//     if (req.user) {
//       populatedUser = await User.findById(req.user._id).populate("candidate");
//     }

//     const Vote = require("../models/Vote");
//     const Rejection = require("../models/Rejection");

//     const voteMap = {};

//     election.candidates.forEach((candidate) => {
//       voteMap[candidate._id.toString()] = {
//         votes: 0,
//         voteLost: 0,
//         isLeading: false,
//         statusLabel: null,
//       };
//     });

//     // Tally votes
//     const voteResults = await Vote.aggregate([
//       { $match: { election: election._id } },
//       { $group: { _id: "$candidate", votes: { $sum: 1 } } },
//     ]);

//     voteResults.forEach((result) => {
//       const cid = result._id.toString();
//       if (voteMap[cid]) {
//         voteMap[cid].votes = result.votes;
//       }
//     });

//     if (election.candidates.length === 1) {
//       // Single candidate logic
//       const candidateId = election.candidates[0]._id.toString();
//       const rejections = await Rejection.countDocuments({
//         election: election._id,
//       });

//       voteMap[candidateId].voteLost = rejections;

//       const votes = voteMap[candidateId].votes;

//       if (votes > rejections) {
//         voteMap[candidateId].isLeading = true;
//         voteMap[candidateId].statusLabel = "Leading";
//       } else if (votes === rejections) {
//         voteMap[candidateId].statusLabel = "Contested";
//       } else {
//         voteMap[candidateId].statusLabel = "Rejected";
//       }
//     } else {
//       // Multi-candidate logic
//       let maxVotes = 0;
//       let topCandidates = [];

//       for (const [cid, stats] of Object.entries(voteMap)) {
//         if (stats.votes > maxVotes) {
//           maxVotes = stats.votes;
//           topCandidates = [cid];
//         } else if (stats.votes === maxVotes) {
//           topCandidates.push(cid);
//         }
//       }

//       if (topCandidates.length === 1) {
//         const leaderId = topCandidates[0];
//         voteMap[leaderId].isLeading = true;
//         voteMap[leaderId].statusLabel = "Leading";
//       } else {
//         topCandidates.forEach((cid) => {
//           voteMap[cid].statusLabel = "Contested";
//         });
//       }
//     }

//     res.render("elections/details", {
//       election,
//       user: populatedUser,
//       voteMap,
//     });
//   } catch (error) {
//     console.error(error);
//     res.status(500).render("error", {
//       errorMessage: "Error fetching election",
//       user: req.user,
//     });
//   }
// };

exports.getElection = async (req, res) => {
  try {
    const election = await Election.findById(req.params.id)
      .populate("candidates")
      .populate("createdBy");

    if (!election) {
      return res.status(404).render("error", {
        errorMessage: "Election not found",
        user: req.user,
      });
    }

    let populatedUser = null;
    if (req.user) {
      populatedUser = await User.findById(req.user._id).populate("candidate");
    }

    const Vote = require("../models/Vote");
    const Rejection = require("../models/Rejection");

    const voteMap = {};

    election.candidates.forEach((candidate) => {
      voteMap[candidate._id.toString()] = {
        votes: 0,
        voteLost: 0,
        isLeading: false,
        statusLabel: null,
        percentage: 0,
      };
    });

    // Tally votes
    const voteResults = await Vote.aggregate([
      { $match: { election: election._id } },
      { $group: { _id: "$candidate", votes: { $sum: 1 } } },
    ]);

    voteResults.forEach((result) => {
      const cid = result._id.toString();
      if (voteMap[cid]) {
        voteMap[cid].votes = result.votes;
      }
    });

    if (election.candidates.length === 1) {
      // Single candidate logic
      const candidateId = election.candidates[0]._id.toString();
      const rejections = await Rejection.countDocuments({
        election: election._id,
      });

      const votes = voteMap[candidateId].votes;
      const total = votes + rejections;

      voteMap[candidateId].voteLost = rejections;
      voteMap[candidateId].percentage =
        total > 0 ? Math.round((votes / total) * 100) : 0;

      if (votes > rejections) {
        voteMap[candidateId].isLeading = true;
        voteMap[candidateId].statusLabel = "Leading";
      } else if (votes === rejections) {
        voteMap[candidateId].statusLabel = "Contested";
      } else {
        voteMap[candidateId].statusLabel = "Rejected";
      }
    } else {
      // Multi-candidate logic
      let maxVotes = 0;
      let topCandidates = [];

      for (const [cid, stats] of Object.entries(voteMap)) {
        if (stats.votes > maxVotes) {
          maxVotes = stats.votes;
          topCandidates = [cid];
        } else if (stats.votes === maxVotes) {
          topCandidates.push(cid);
        }
      }

      if (topCandidates.length === 1) {
        const leaderId = topCandidates[0];
        voteMap[leaderId].isLeading = true;
        voteMap[leaderId].statusLabel = "Leading";
      } else {
        topCandidates.forEach((cid) => {
          voteMap[cid].statusLabel = "Contested";
        });
      }

      // Add percentage for all candidates (multi-candidate)
      const totalVotes = Object.values(voteMap).reduce(
        (sum, c) => sum + c.votes,
        0
      );
      Object.entries(voteMap).forEach(([cid, stats]) => {
        stats.percentage =
          totalVotes > 0 ? Math.round((stats.votes / totalVotes) * 100) : 0;
      });
    }

    res.render("elections/details", {
      election,
      user: populatedUser,
      voteMap,
    });
  } catch (error) {
    console.error(error);
    res.status(500).render("error", {
      errorMessage: "Error fetching election",
      user: req.user,
    });
  }
};

// POST /elections/:id/add-candidate – Join election
exports.addCandidateToElection = async (req, res) => {
  try {
    const election = await Election.findById(req.params.id);
    if (!election || election.electionStatus !== "draft") {
      return res.status(400).send("Election not accepting candidates");
    }

    const { candidateNumber } = req.body;
    const candidate = await Candidate.findOne({ candidateNumber });

    if (!candidate) {
      return res.status(404).send("Candidate not found");
    }

    const candidateId = candidate._id;

    if (!election.candidates.includes(candidateId)) {
      election.candidates.push(candidateId);
      await election.save();
    }

    res.redirect(`/api/elections/${election._id}`);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error adding candidate to election");
  }
};

// POST /elections/:id/launch – Launch the election
exports.launchElection = async (req, res) => {
  try {
    const election = await Election.findById(req.params.id);

    if (!election) {
      return res.status(404).render("error", {
        errorMessage: "Election not found",
      });
    }

    // Only the creator can launch
    if (!election.createdBy.equals(req.user.candidate._id)) {
      return res.status(403).render("error", {
        errorMessage: "You are not authorized to launch this election",
      });
    }

    // Check if already launched or not in draft mode
    if (election.electionStatus !== "draft") {
      return res.status(400).render("error", {
        errorMessage: "Only elections in draft mode can be launched",
      });
    }

    // Launch the election
    election.electionStatus = "ongoing";
    await election.save();

    // Directly render the myElections.ejs page
    const elections = await Election.find({
      createdBy: req.user.candidate._id,
    });

    res.render("elections/myElections", {
      elections,
      user: req.user,
      currentDate: new Date(),
    });
  } catch (error) {
    console.error(error);
    res.status(500).render("error", {
      errorMessage: "Error launching election",
    });
  }
};

// GET /elections/:id/results – View election results

exports.getElectionResults = async (req, res) => {
  try {
    const election = await Election.findById(req.params.id).populate(
      "candidates"
    );

    if (!election) {
      return res.status(404).render("error", {
        errorMessage: "Election not found",
      });
    }

    // Optional: auto-complete election if past endDate
    if (
      election.electionStatus === "ongoing" &&
      new Date() > new Date(election.endDate)
    ) {
      election.electionStatus = "completed";
      await election.save();
    }

    res.render("elections/results", { election });
  } catch (error) {
    res.status(500).render("error", {
      errorMessage: "Error loading election results",
    });
  }
};
