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
  totalVoteAndRejection: {
    type: Number,
    default: 0,
  },
  electionContext: {
    type: String,
    default: "",
  },

  willRunIn: {
    type: String,
    required: true, // Examples: "Zambia", "Ndola District", "Chimwemwe Constituency", "Itawa Ward"
  },

  // aiInsights: {
  //   type: Map,
  //   of: new mongoose.Schema(
  //     {
  //       "Demographic Profile": {
  //         content: { type: String, default: null },
  //         pdfUploaded: { type: Boolean, default: false },
  //       },
  //       "Educational Journey": {
  //         content: { type: String, default: null },
  //         pdfUploaded: { type: Boolean, default: false },
  //       },
  //       "Living Context": {
  //         content: { type: String, default: null },
  //         pdfUploaded: { type: Boolean, default: false },
  //       },
  //       "Economic Factors": {
  //         content: { type: String, default: null },
  //         pdfUploaded: { type: Boolean, default: false },
  //       },
  //       "Policy Awareness & Political Behavior": {
  //         content: { type: String, default: null },
  //         pdfUploaded: { type: Boolean, default: false },
  //       },
  //       "Sentiment & Expectations": {
  //         content: { type: String, default: null },
  //         pdfUploaded: { type: Boolean, default: false },
  //       },
  //     },
  //     { _id: false }
  //   ),
  //   default: {},
  // },

  aiInsights: {
    type: Map,
    of: new mongoose.Schema(
      {
        "Demographic Profile": {
          content: { type: String, default: null },
          pdfUploaded: { type: Boolean, default: false },
        },
        "Educational Journey": {
          content: { type: String, default: null },
          pdfUploaded: { type: Boolean, default: false },
        },
        "Living Context": {
          content: { type: String, default: null },
          pdfUploaded: { type: Boolean, default: false },
        },
        "Economic Factors": {
          content: { type: String, default: null },
          pdfUploaded: { type: Boolean, default: false },
        },
        "Policy Awareness & Political Behavior": {
          content: { type: String, default: null },
          pdfUploaded: { type: Boolean, default: false },
        },
        "Sentiment & Expectations": {
          content: { type: String, default: null },
          pdfUploaded: { type: Boolean, default: false },
        },
        "Religious Affiliation Insight": {
          content: { type: String, default: null },
          pdfUploaded: { type: Boolean, default: false },
        },
        "Consolidated Insight": {
          content: { type: String, default: null },
          pdfUploaded: { type: Boolean, default: false },
        },
        "Probability of Victory": {
          content: { type: String, default: null },
          pdfUploaded: { type: Boolean, default: false },
        },
      },
      { _id: false }
    ),
    default: {},
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

// const mongoose = require("mongoose");
// const Counter = require("./Counter");

// const aiInsightSchema = new mongoose.Schema(
//   {
//     content: { type: String, default: null },
//     pdfUploaded: { type: Boolean, default: false },
//   },
//   { _id: false }
// );

// const electionSchema = new mongoose.Schema({
//   electionNumber: { type: Number, unique: true }, // Auto-incremented election number
//   type: {
//     type: String,
//     enum: ["presidential", "parliamentary", "mayoral", "councillor"],
//     required: true,
//   },
//   startDate: { type: Date, required: true },
//   endDate: { type: Date, required: true },
//   candidates: [{ type: mongoose.Schema.Types.ObjectId, ref: "Candidate" }],
//   totalVotes: { type: Number, default: 0 },
//   voteRejected: { type: Number, default: 0 },
//   electionDurationMs: { type: Number },

//   electionContext: { type: String, default: "" },

//   aiInsights: {
//     type: Map,
//     of: aiInsightSchema,
//     default: {},
//   },

//   result: {
//     type: Map,
//     of: Number,
//     default: new Map(),
//   },

//   electionStatus: {
//     type: String,
//     enum: ["draft", "ongoing", "completed", "canceled"],
//     default: "draft",
//   },
//   createdBy: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: "Candidate",
//     required: true,
//   },
// });

// // Auto-increment Election Number
// electionSchema.pre("save", async function (next) {
//   if (this.isNew) {
//     try {
//       const counter = await Counter.findByIdAndUpdate(
//         { _id: "electionNumber" },
//         { $inc: { seq: 1 } },
//         { new: true, upsert: true }
//       );
//       this.electionNumber = counter.seq + 100; // Start from 100
//     } catch (err) {
//       return next(err);
//     }
//   }
//   next();
// });

// module.exports = mongoose.model("Election", electionSchema);
