const mongoose = require("mongoose");
const Counter = require("./Counter");

const candidateSchema = new mongoose.Schema({
  candidateNumber: { type: Number, unique: true }, // Auto-incremented candidate number
  name: { type: String, required: true }, // Candidate's full name
  // email: { type: String, unique: true, required: true }, // Candidate's email address
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },

  mobile: { type: String, required: true }, // Candidate's mobile number
  membershipStatus: {
    type: String,
    enum: ["active", "pending", "expired"],
    default: "pending",
  },

  membershipExpiresOn: {
    type: Date,
    required: false, // Optional if not all candidates have a membership
  },

  // ✅ Verification field
  verified: {
    type: Boolean,
    default: false, // All new candidates are unverified by default
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User", // or "SystemAdmin"
    default: null,
  },
  registeredForElectionType: {
    type: String,
    enum: ["presidential", "parliamentary", "mayoral", "councillor"],
    required: true,
  },

  // 🆕 Tracking fields

  hasCalledAnElection: {
    type: Boolean,
    default: false,
  },

  electionsCalled: { type: Number, default: 0 },
  electionsJoined: { type: Number, default: 0 },

  bio: { type: String, required: true }, // Short bio
  party: { type: String, default: "Independent" }, // Political party
  profileImage: { type: String }, // URL for profile image
  partySymbol: { type: String }, // URL for party symbol
  elections: [{ type: mongoose.Schema.Types.ObjectId, ref: "Election" }], // Array of associated elections
  invitedElections: [{ type: mongoose.Schema.Types.ObjectId, ref: "Election" }],
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", unique: true }, // Linked user account
});

// Auto-increment Candidate Number
candidateSchema.pre("save", async function (next) {
  if (this.isNew) {
    try {
      const counter = await Counter.findByIdAndUpdate(
        { _id: "candidate" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      this.candidateNumber = counter.seq + 2500; // Start from 2500
    } catch (err) {
      return next(err);
    }
  }
  next();
});

module.exports = mongoose.model("Candidate", candidateSchema);
