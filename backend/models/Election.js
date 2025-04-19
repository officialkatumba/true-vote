const mongoose = require("mongoose");
const Counter = require("./Counter");

const electionSchema = new mongoose.Schema({
  electionNumber: { type: Number, unique: true }, // Auto-incremented election number
  type: {
    type: String,
    enum: ["presidential", "parliamentary", "mayoral", "councillor"],
    required: true,
  },
  startDate: { type: Date, required: true }, // Start date
  endDate: { type: Date, required: true }, // End date
  candidates: [{ type: mongoose.Schema.Types.ObjectId, ref: "Candidate" }], // List of candidates
  totalVotes: { type: Number, default: 0 }, // Total votes counted
  voteRejected: { type: Number, default: 0 }, // Invalid votes
  electionDurationMs: {
    type: Number, // store duration in milliseconds
    required: false,
  },

  // Mapping each candidate (by ObjectId or candidateNumber) to votes received
  result: {
    type: Map,
    of: Number,
    default: new Map(),
  },

  electionStatus: {
    type: String,
    enum: ["draft", "ongoing", "completed", "canceled"],
    default: "draft",
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Candidate",
    required: true,
  },
});

// Auto-increment Election Number
electionSchema.pre("save", async function (next) {
  if (this.isNew) {
    try {
      const counter = await Counter.findByIdAndUpdate(
        { _id: "electionNumber" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      this.electionNumber = counter.seq + 100; // Start from 100
    } catch (err) {
      return next(err);
    }
  }
  next();
});

module.exports = mongoose.model("Election", electionSchema);
