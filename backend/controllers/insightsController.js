const Vote = require("../models/Vote");
const Rejection = require("../models/Rejection");
const Election = require("../models/Election");
const InsightSection = require("../models/InsightSection");
const generateInsightSection = require("../utils/generateInsightSection");
const insightGroups = require("../helpers/insightGroups");

exports.generateReport = async (req, res) => {
  try {
    const { id: electionId } = req.params;
    const { _id: candidateId } = req.user.candidate;

    // Get election data
    const election = await Election.findById(electionId);
    if (!election) return res.status(404).send("Election not found");

    // Verify candidate participation
    const isParticipant = election.candidates.some((c) =>
      c.equals(candidateId)
    );
    if (!isParticipant) return res.status(403).send("Access denied");

    // Get basic vote counts
    const [myVotes, allVotes] = await Promise.all([
      Vote.countDocuments({ election: electionId, candidate: candidateId }),
      Vote.countDocuments({ election: electionId }),
    ]);

    // Prepare quick stats
    const stats = {
      totalVotesForMe: myVotes,
      totalElectionVotes: allVotes,
    };

    // Check for existing insight sections
    const insightSections = await InsightSection.find({
      election: electionId,
      candidate: candidateId,
    });

    // Render the report template
    res.render("insights/report", {
      election,
      stats,
      candidateId,
      insightSections,
    });
  } catch (error) {
    console.error("Error generating report:", error);
    res.status(500).send("Failed to generate report.");
  }
};

exports.generateAllInsightsForCandidate = async (req, res) => {
  try {
    const electionId = req.params.id;
    const candidateId = req.user._id;

    const election = await Election.findById(electionId).populate("candidates");
    if (!election) return res.status(404).json({ error: "Election not found" });

    const candidateInElection = election.candidates.some((c) =>
      c.equals(candidateId)
    );
    if (!candidateInElection) {
      return res.status(403).json({
        error: "Candidate did not participate in this election.",
      });
    }

    const existingInsights = await InsightSection.find({
      election: electionId,
      candidate: candidateId,
    });
    if (existingInsights.length > 0) {
      return res.status(409).json({
        message: "Insights already generated for this candidate and election.",
      });
    }

    const votes = await Vote.find({
      election: electionId,
      candidate: candidateId,
    });
    const rejections = await Rejection.find({
      election: electionId,
      candidate: candidateId,
    });

    const titles = Object.keys(insightGroups);
    const generatedSections = [];

    for (const title of titles) {
      const section = await generateInsightSection({
        election,
        candidate: { _id: candidateId },
        votes,
        rejections,
        title,
      });
      generatedSections.push(section);
    }

    return res.status(201).json({
      message: "Insights generated successfully.",
      sections: generatedSections,
    });
  } catch (err) {
    console.error("Error generating insights:", err);
    return res.status(500).json({ error: "Server error" });
  }
};
