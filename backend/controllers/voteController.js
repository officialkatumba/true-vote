const Vote = require("../models/Vote");
const Election = require("../models/Election");
const Candidate = require("../models/Candidate");
const Voucher = require("../models/Voucher");

// exports.castVote = async (req, res) => {
//   try {
//     const {
//       electionId,
//       candidateId,
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
//       sectorOfOperation,
//       votingEligibility2026,
//       expectationsFromCandidate,
//       relativeVoteLikelihood,
//       reasonForRelativeVote,
//       reasonForVoting,
//       usualPartySupport,
//       familiarWithPolicies,
//       policyUnderstanding,
//     } = req.body;

//     // Check if election is ongoing
//     const election = await Election.findById(electionId);
//     if (!election || election.electionStatus !== "ongoing") {
//       return res.status(400).json({ message: "Election is not active" });
//     }

//     // Create new voucher
//     const voucher = await Voucher.create({});

//     // Create vote
//     const vote = new Vote({
//       election: electionId,
//       candidate: candidateId,
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
//       sectorOfOperation,
//       votingEligibility2026,
//       expectationsFromCandidate,
//       relativeVoteLikelihood,
//       reasonForRelativeVote,
//       reasonForVoting,
//       usualPartySupport,
//       familiarWithPolicies,
//       policyUnderstanding,
//     });

//     await vote.save();

//     // Link election to candidate if not already
//     await Candidate.findByIdAndUpdate(candidateId, {
//       $addToSet: { elections: electionId },
//     });

//     // Redirect to thank-you page with the voucher number
//     // res.redirect(`/thank-you?voucherNumber=${voucher.voucherNumber}`);
//     res.redirect(`/api/votes/thank-you?voucherNumber=${voucher.voucherNumber}`);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: "An error occurred", error: err.message });
//   }
// };

exports.castVote = async (req, res) => {
  try {
    const {
      electionId,
      candidateId,
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
      sectorOfOperation,
      votingEligibility2026,
      expectationsFromCandidate,
      relativeVoteLikelihood,
      reasonForRelativeVote,
      reasonForVoting,
      usualPartySupport,
      familiarWithPolicies,
      policyUnderstanding,
    } = req.body;

    // Step 1: Fetch election
    const election = await Election.findById(electionId);
    if (!election || election.electionStatus !== "ongoing") {
      return res.status(400).json({ message: "Election is not active" });
    }

    // Step 2: Block if totalVoteAndRejection reached 1000
    // if (election.totalVoteAndRejection >= 1000) {
    //   return res.status(400).json({ message: "Voting limit reached" });
    // }

    if (election.totalVoteAndRejection >= 1000) {
      return res.redirect("/vote/voting-closed");
    }

    // Step 3: Create voucher
    const voucher = await Voucher.create({});

    // Step 4: Create and save the vote
    const vote = new Vote({
      election: electionId,
      candidate: candidateId,
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
      sectorOfOperation,
      votingEligibility2026,
      expectationsFromCandidate,
      relativeVoteLikelihood,
      reasonForRelativeVote,
      reasonForVoting,
      usualPartySupport,
      familiarWithPolicies,
      policyUnderstanding,
    });

    await vote.save(); // ✅ Save vote BEFORE incrementing

    // Step 5: Increment counts after vote is saved
    election.totalVotes += 1;
    election.totalVoteAndRejection += 1;

    // Step 6: Optionally mark as completed
    if (election.totalVoteAndRejection >= 1000) {
      election.electionStatus = "completed";
    }

    await election.save();

    // Step 7: Link candidate to election
    await Candidate.findByIdAndUpdate(candidateId, {
      $addToSet: { elections: electionId },
    });

    // Step 8: Redirect to thank-you
    res.redirect(`/api/votes/thank-you?voucherNumber=${voucher.voucherNumber}`);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "An error occurred", error: err.message });
  }
};

exports.getResults = async (req, res) => {
  try {
    const election = await Election.findById(req.params.id).populate(
      "candidates"
    );
    if (!election)
      return res.status(404).json({ message: "Election not found" });

    // Count votes per candidate
    const results = await Vote.aggregate([
      { $match: { election: election._id } },
      { $group: { _id: "$candidate", votes: { $sum: 1 } } },
    ]);

    res.json({ election, results });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};
