// models/Rejection.js
const mongoose = require("mongoose");

const rejectionSchema = new mongoose.Schema({
  election: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Election",
    required: true,
  },
  voucher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Voucher",
    required: true,
    unique: true,
  },
  // reason: { type: String, required: false },

  // Demographics
  age: Number,
  gender: { type: String, enum: ["male", "female", "other"] },
  highestEducation: {
    type: String,
    enum: [
      "none",
      "primary",
      "secondary",
      "diploma",
      "bachelor",
      "master",
      "PhD",
    ],
  },
  incomeLevel: { type: String, enum: ["low", "medium", "high"] },
  maritalStatus: {
    type: String,
    enum: [
      "single",
      "married",
      "divorced",
      "married parent",
      "single mom",
      "single dad",
    ],
  },
  religiousStatus: {
    type: String,
    enum: ["not religious", "slightly religious", "very religious"],
  },
  dwellingType: { type: String, enum: ["urban", "rural"] },
  familyDwellingType: { type: String, enum: ["urban", "rural"] },

  // Education
  provinceOfStudy: String,
  schoolCompletionLocation: String,

  // Voting Eligibility
  votingEligibility2026: { type: String, enum: ["yes", "no", "not_sure"] },

  // Financial
  sectorOfOperation: {
    type: String,
    enum: ["employee", "marketeer", "unemployed", "trader"],
  },

  // Insights
  relativeVoteLikelihood: Boolean,
  reasonForRelativeVote: String,
  expectationsFromCandidate: String,
  usualPartySupport: String,
  reasonForVoting: String,
  familiarWithPolicies: Boolean,
  policyUnderstanding: String,

  submittedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Rejection", rejectionSchema);
