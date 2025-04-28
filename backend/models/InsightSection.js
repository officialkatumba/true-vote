// models/InsightSection.js
const mongoose = require("mongoose");

const insightSectionSchema = new mongoose.Schema(
  {
    election: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Election",
      required: true,
    },
    candidate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Candidate",
      required: true,
    },
    title: {
      type: String,
      required: true,
      enum: [
        "Demographic Profile",
        "Educational Journey",
        "Living Context",
        "Economic Factors",
        "Policy Awareness & Political Behavior",
        "Sentiment & Expectations",
      ],
    },
    content: {
      type: String,
      required: true,
    },
    analysisType: {
      type: String,
      required: true,
      enum: ["votes", "rejections", "comparative"],
      default: "votes", // Changed default to votes-only
    },
    metrics: {
      // Demographic Profile
      ageAnalysis: {
        votingRanges: [
          {
            range: String,
            percentage: Number,
          },
        ],
        rejectionRanges: {
          // Made optional
          type: [
            {
              range: String,
              percentage: Number,
            },
          ],
          required: false,
        },
      },
      genderDistribution: {
        votes: {
          male: Number,
          female: Number,
          other: Number,
        },
        rejections: {
          // Made optional
          type: {
            male: Number,
            female: Number,
            other: Number,
          },
          required: false,
        },
      },

      // All other metrics follow same pattern - votes required, rejections optional
      // Educational Journey
      educationLevels: {
        votes: {
          type: Map,
          of: Number,
          required: true,
        },
        rejections: {
          type: Map,
          of: Number,
          required: false,
        },
      },

      // Sentiment Analysis (simplified structure)
      keySentiments: {
        votes: {
          type: {
            // ✅ Add explicit type definition
            positive: [String],
            negative: [String],
          },
          required: true, // ✅ Move required to proper position
        },
        rejections: {
          type: {
            positive: [String],
            negative: [String],
          },
          required: false,
        },
      },

      // Added meta field to track data availability
      dataAvailability: {
        hasRejectionData: {
          type: Boolean,
          default: false,
          required: true,
        },
        lastDataRefresh: Date,
      },
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    // Schema options
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for checking if comparative analysis is possible
insightSectionSchema.virtual("canCompare").get(function () {
  return (
    this.dataAvailability.hasRejectionData &&
    this.analysisType === "comparative"
  );
});

// Middleware to update dataAvailability before save
insightSectionSchema.pre("save", function (next) {
  // Check if any rejection data exists
  if (
    this.metrics &&
    Object.values(this.metrics).some(
      (metric) => metric.rejections && Object.keys(metric.rejections).length > 0
    )
  ) {
    this.dataAvailability.hasRejectionData = true;
  } else {
    this.dataAvailability.hasRejectionData = false;
    // If no rejection data exists, force analysisType to 'votes'
    if (this.analysisType === "comparative") {
      this.analysisType = "votes";
    }
  }

  this.dataAvailability.lastDataRefresh = new Date();
  next();
});

module.exports = mongoose.model("InsightSection", insightSectionSchema);
