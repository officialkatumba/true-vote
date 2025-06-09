const Rejection = require("../models/Rejection");
const Election = require("../models/Election");
const Voucher = require("../models/Voucher");
const Candidate = require("../models/Candidate");

// Displaying the form to reject the candidate

// exports.getRejectForm = async (req, res) => {
//   const election = await Election.findById(req.params.electionId);
//   if (!election || election.candidates.length !== 1) {
//     return res
//       .status(404)
//       .send("Rejection form only applies to single-candidate elections.");
//   }

//   res.render("vote/reject-form", { election });
// };
// controllers/rejectionController.js
// const Election = require("../models/Election");
// const Candidate = require("../models/Candidate");

exports.getRejectForm = async (req, res) => {
  try {
    const { electionId } = req.params;

    const election = await Election.findById(electionId);
    if (!election) {
      return res.status(404).send("Election not found");
    }

    if (election.candidates.length !== 1) {
      return res
        .status(400)
        .send("Rejection form only applies to single-candidate elections.");
    }

    const candidateId = election.candidates[0]; // get candidate from election
    const candidate = await Candidate.findById(candidateId);
    if (!candidate) {
      return res.status(404).send("Candidate not found");
    }

    res.render("vote/reject-form", {
      electionId,
      election,
      candidateId,
      candidate,
    });
  } catch (err) {
    console.error("Error loading reject form:", err);
    res.status(500).send("Server error");
  }
};

// // Handling the submission of a rejection

// exports.submitRejection = async (req, res) => {
//   try {
//     const {
//       electionId,
//       reason,
//       relativeVoteLikelihood,
//       age,
//       gender,
//       highestEducation,
//       employmentStatus,
//       maritalStatus,
//       religiousStatus,
//       dwellingType,
//       familyDwellingType,
//       provinceOfStudy,
//       schoolCompletionLocation,
//       district,
//       constituency, // <-- new field
//       averageMonthlyRent,
//       sectorOfOperation,
//       dislikesAboutCandidate,
//       expectationsFromCandidate,
//       reasonForRelativeVote,
//       usualPartySupport,
//       familiarWithPolicies,
//       policyUnderstanding,
//     } = req.body;

//     const election = await Election.findById(electionId);
//     if (!election || election.electionStatus !== "ongoing") {
//       return res.status(400).json({
//         success: false,
//         message: "Election is not active or does not exist.",
//       });
//     }

//     const voucher = await Voucher.create({});

//     const rejection = new Rejection({
//       election: electionId,
//       reason,
//       relativeVoteLikelihood: relativeVoteLikelihood === "true",
//       voucher: voucher._id,
//       age,
//       gender,
//       highestEducation,
//       employmentStatus,
//       maritalStatus,
//       religiousStatus,
//       dwellingType,
//       familyDwellingType,
//       provinceOfStudy,
//       schoolCompletionLocation,
//       district,
//       constituency,
//       averageMonthlyRent,
//       sectorOfOperation,
//       dislikesAboutCandidate,
//       expectationsFromCandidate,
//       reasonForRelativeVote,
//       usualPartySupport,
//       familiarWithPolicies: familiarWithPolicies === "true",
//       policyUnderstanding,
//     });

//     await rejection.save();

//     // 🔁 Redirect to thank-you page (same logic as castVote)
//     return res.redirect(
//       `/api/votes/thank-you?voucherNumber=${voucher.voucherNumber}`
//     );
//   } catch (err) {
//     console.error("❌ Rejection submission error:", err);
//     return res.status(500).json({
//       success: false,
//       message: "An unexpected error occurred. Please try again later.",
//     });
//   }
// };

// exports.submitRejection = async (req, res) => {
//   try {
//     const electionId = req.params.electionId;

//     const {
//       reason,
//       relativeVoteLikelihood,
//       age,
//       gender,
//       highestEducation,
//       employmentStatus,
//       maritalStatus,
//       religiousStatus,
//       dwellingType,
//       familyDwellingType,
//       provinceOfStudy,
//       schoolCompletionLocation,
//       district,
//       constituency,
//       averageMonthlyRent,
//       sectorOfOperation,
//       dislikesAboutCandidate,
//       expectationsFromCandidate,
//       reasonForRelativeVote,
//       usualPartySupport,
//       familiarWithPolicies,
//       policyUnderstanding,
//     } = req.body;

//     const election = await Election.findById(electionId);
//     if (!election || election.electionStatus !== "ongoing") {
//       return res.status(400).json({
//         success: false,
//         message: "Election is not active or does not exist.",
//       });
//     }

//     const voucher = await Voucher.create({});

//     const rejection = new Rejection({
//       election: electionId,
//       reason,
//       relativeVoteLikelihood: relativeVoteLikelihood === "true",
//       voucher: voucher._id,
//       age,
//       gender,
//       highestEducation,
//       employmentStatus,
//       maritalStatus,
//       religiousStatus,
//       dwellingType,
//       familyDwellingType,
//       provinceOfStudy,
//       schoolCompletionLocation,
//       district,
//       constituency,
//       averageMonthlyRent,
//       sectorOfOperation,
//       dislikesAboutCandidate,
//       expectationsFromCandidate,
//       reasonForRelativeVote,
//       usualPartySupport,
//       familiarWithPolicies: familiarWithPolicies === "true",
//       policyUnderstanding,
//     });

//     await rejection.save();

//     return res.redirect(
//       `/api/votes/thank-you?voucherNumber=${voucher.voucherNumber}`
//     );
//   } catch (err) {
//     console.error("❌ Rejection submission error:", err);
//     return res.status(500).json({
//       success: false,
//       message: "An unexpected error occurred. Please try again later.",
//     });
//   }
// };

exports.submitRejection = async (req, res) => {
  try {
    const electionId = req.params.electionId;

    const {
      reason,
      relativeVoteLikelihood,
      age,
      gender,
      highestEducation,
      employmentStatus,
      maritalStatus,
      religiousStatus,
      dwellingType,
      familyDwellingType,
      provinceOfStudy,
      schoolCompletionLocation,
      district,
      constituency,
      averageMonthlyRent,
      sectorOfOperation,
      dislikesAboutCandidate,
      expectationsFromCandidate,
      reasonForRelativeVote,
      usualPartySupport,
      familiarWithPolicies,
      policyUnderstanding,
    } = req.body;

    // Step 1: Fetch and validate election
    const election = await Election.findById(electionId);
    if (!election || election.electionStatus !== "ongoing") {
      return res.status(400).json({
        success: false,
        message: "Election is not active or does not exist.",
      });
    }

    // Step 2: Block if vote/rejection cap reached
    // if (election.totalVoteAndRejection >= 1000) {
    //   return res.status(400).json({
    //     success: false,
    //     message: "Voting limit reached. No more votes or rejections allowed.",
    //   });
    // }

    if (election.totalVoteAndRejection >= 1000) {
      return res.redirect("/vote/voting-closed");
    }

    // Step 3: Create voucher
    const voucher = await Voucher.create({});

    // Step 4: Create and save rejection
    const rejection = new Rejection({
      election: electionId,
      reason,
      relativeVoteLikelihood: relativeVoteLikelihood === "true",
      voucher: voucher._id,
      age,
      gender,
      highestEducation,
      employmentStatus,
      maritalStatus,
      religiousStatus,
      dwellingType,
      familyDwellingType,
      provinceOfStudy,
      schoolCompletionLocation,
      district,
      constituency,
      averageMonthlyRent,
      sectorOfOperation,
      dislikesAboutCandidate,
      expectationsFromCandidate,
      reasonForRelativeVote,
      usualPartySupport,
      familiarWithPolicies: familiarWithPolicies === "true",
      policyUnderstanding,
    });

    await rejection.save(); // ✅ Save first

    // Step 5: Increment counts after successful save
    election.totalRejections += 1;
    election.totalVoteAndRejection += 1;

    // Step 6: Mark election as completed if 1000 limit reached
    if (election.totalVoteAndRejection >= 1000) {
      election.electionStatus = "completed";
    }

    await election.save();

    // Step 7: Redirect to thank-you page
    return res.redirect(
      `/api/votes/thank-you?voucherNumber=${voucher.voucherNumber}`
    );
  } catch (err) {
    console.error("❌ Rejection submission error:", err);
    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred. Please try again later.",
    });
  }
};
