const mongoose = require("mongoose");

const rejectionSchema = new mongoose.Schema({
  election: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Election",
    required: true,
  },
  reason: { type: String, required: true },
  relativeVoteLikelihood: { type: Boolean, required: true },
  voucher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Voucher",
    required: true,
    unique: true,
  },

  // Demographic Info
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
  employmentStatus: {
    type: String,
    enum: ["employed", "unemployed", "self-employed", "student"],
  },
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

  // Education & Voting Locations
  provinceOfStudy: String,
  schoolCompletionLocation: String,
  district: String,
  constituency: String,

  // Economic
  averageMonthlyRent: Number,
  sectorOfOperation: {
    type: String,
    enum: [
      "marketeer",
      "online trader",
      "cross-border trader",
      "small business Owner",
      "street vendor",
    ],
  },

  // Perceptions & Influences
  dislikesAboutCandidate: String,
  expectationsFromCandidate: String,
  reasonForRelativeVote: String,
  usualPartySupport: String,
  familiarWithPolicies: Boolean,
  policyUnderstanding: String,

  submittedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Rejection", rejectionSchema);
