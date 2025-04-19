const Vote = require("../models/Vote");
const Election = require("../models/Election");
const Candidate = require("../models/Candidate");
const Voucher = require("../models/Voucher");

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
      averageMonthlyRent,
      sectorOfOperation,
      dislikesAboutCandidate,
      expectationsFromCandidate,
      relativeVoteLikelihood,
      reasonForRelativeVote,
      reasonForVoting,
      usualPartySupport,
      familiarWithPolicies,
      policyUnderstanding,
    } = req.body;

    // Check if election is ongoing
    const election = await Election.findById(electionId);
    if (!election || election.electionStatus !== "ongoing") {
      return res.status(400).json({ message: "Election is not active" });
    }

    // Create new voucher
    const voucher = await Voucher.create({});

    // Create vote
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
      averageMonthlyRent,
      sectorOfOperation,
      dislikesAboutCandidate,
      expectationsFromCandidate,
      relativeVoteLikelihood,
      reasonForRelativeVote,
      reasonForVoting,
      usualPartySupport,
      familiarWithPolicies,
      policyUnderstanding,
    });

    await vote.save();

    // Link election to candidate if not already
    await Candidate.findByIdAndUpdate(candidateId, {
      $addToSet: { elections: electionId },
    });

    // Redirect to thank-you page with the voucher number
    // res.redirect(`/thank-you?voucherNumber=${voucher.voucherNumber}`);
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
