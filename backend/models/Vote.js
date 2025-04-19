const mongoose = require("mongoose");

const voteSchema = new mongoose.Schema({
  election: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Election",
    required: true,
  }, // Election ID
  candidate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Candidate",
    required: true,
  }, // Candidate ID
  voucher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Voucher",
    required: true,
    unique: true,
  }, // Replacing mobileNumber for privacy
  voteTime: { type: Date, default: Date.now }, // Timestamp of the vote

  // 🔹 Demographic Information for Candidate Insights
  age: { type: Number, required: true }, // Voter’s age
  gender: { type: String, required: true, enum: ["male", "female", "other"] }, // Gender identity
  highestEducation: {
    type: String,
    required: true,
    enum: [
      "none",
      "primary",
      "secondary",
      "diploma",
      "bachelor",
      "master",
      "PhD",
    ],
  }, // Highest level of education
  employmentStatus: {
    type: String,
    required: true,
    enum: ["employed", "unemployed", "self-employed", "student"],
  }, // Job status
  maritalStatus: {
    type: String,
    required: true,
    enum: [
      "single",
      "married",
      "divorced",
      "married parent",
      "single mom",
      "single dad",
    ],
  }, // Marital status categories
  religiousStatus: {
    type: String,
    required: true,
    enum: ["not religious", "slightly religious", "very religious"],
  }, // Religious affiliation
  dwellingType: { type: String, required: true, enum: ["urban", "rural"] }, // Where the voter lives
  familyDwellingType: {
    type: String,
    required: true,
    enum: ["urban", "rural"],
  }, // Where their family lives

  // 🔹 Education & Background
  provinceOfStudy: { type: String, required: true }, // Province where voter studied
  schoolCompletionLocation: { type: String, required: true }, // Where they completed school

  // 🔹 Financial Status (Captured Discreetly)
  averageMonthlyRent: { type: Number, required: true }, // Voter's financial situation
  sectorOfOperation: {
    type: String,
    required: true,
    enum: [
      "marketeer",
      "online trader",
      "shop owner",
      "street vendor",
      "other side hustles",
    ],
  }, // Employment sector

  dislikesAboutCandidate: {
    type: String,
    required: false,
    trim: true,
  }, // Optional: Captures what the voter dislikes about the candidate (useful for approval rating analysis)

  expectationsFromCandidate: {
    type: String,
    required: false,
    trim: true,
  }, // Optional: Captures what the voter wants the candidate to do or stand for (helps in shaping campaign messaging)

  // 🔹 Influence of Close Relatives & Friends
  relativeVoteLikelihood: { type: Number, required: true, min: 1, max: 10 }, // Probability close relatives/friends will vote for the same candidate
  reasonForRelativeVote: { type: String, required: true }, // Explanation of why relatives/friends might vote for or against the candidate

  // 🔹 Personal Voting Decision
  reasonForVoting: { type: String, required: true }, // Why they voted for this candidate
  usualPartySupport: { type: String, required: true }, // Party they normally support

  // 🔹 Candidate Policy Awareness
  familiarWithPolicies: { type: Boolean, required: true }, // Checks if voter knows the candidate’s policies
  policyUnderstanding: { type: String, required: false, trim: true }, // Optional: What they know about the candidate's policies
});

module.exports = mongoose.model("Vote", voteSchema);
