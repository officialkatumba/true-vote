const Rejection = require("../models/Rejection");
const Election = require("../models/Election");
const Voucher = require("../models/Voucher");

// Displaying the form to reject the candidate

exports.getRejectForm = async (req, res) => {
  const election = await Election.findById(req.params.electionId);
  if (!election || election.candidates.length !== 1) {
    return res
      .status(404)
      .send("Rejection form only applies to single-candidate elections.");
  }

  res.render("vote/reject-form", { election });
};
// Handling the submission of a rejection

exports.submitRejection = async (req, res) => {
  try {
    const {
      electionId,
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
      constituency, // <-- new field
      averageMonthlyRent,
      sectorOfOperation,
      dislikesAboutCandidate,
      expectationsFromCandidate,
      reasonForRelativeVote,
      usualPartySupport,
      familiarWithPolicies,
      policyUnderstanding,
    } = req.body;

    const election = await Election.findById(electionId);
    if (!election || election.electionStatus !== "ongoing") {
      return res.status(400).json({
        success: false,
        message: "Election is not active or does not exist.",
      });
    }

    const voucher = await Voucher.create({});

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

    await rejection.save();

    // 🔁 Redirect to thank-you page (same logic as castVote)
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
