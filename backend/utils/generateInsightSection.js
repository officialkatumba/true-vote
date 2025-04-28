// const Election = require("../models/Election");
// const Candidate = require("../models/Candidate");
// const generateInsightSection = require("../utils/generateInsightSection");

// const insightTitles = [
//   "Demographic Profile",
//   "Educational Journey",
//   "Living Context",
//   "Economic Factors",
//   "Policy Awareness & Political Behavior",
//   "Sentiment & Expectations",
// ];

// exports.generateAllInsightsForCandidate = async (req, res) => {
//   try {
//     // const electionId = req.params.id;
//     // const candidateId = req.user._id; // assuming this comes from authenticated candidate

//     // const [election, candidate] = await Promise.all([
//     //   Election.findById(electionId).select("candidates insightSections"),
//     //   Candidate.findById(candidateId),
//     // ]);

//     // if (!election || !candidate) {
//     //   return res
//     //     .status(404)
//     //     .json({ error: "Election or candidate not found." });
//     // }

//     // // Ensure candidate is part of this election
//     // const isParticipant = election.candidates.some(
//     //   (c) => c.toString() === candidate._id.toString()
//     // );

//     // if (!isParticipant) {
//     //   return res
//     //     .status(400)
//     //     .json({ error: "Candidate did not participate in this election." });
//     // }

//     const [election, candidate] = await Promise.all([
//       Election.findById(electionId)
//         .select("candidates insightSections")
//         .populate("candidates", "_id"), // 👈 populate only _id
//       Candidate.findById(candidateId),
//     ]);

//     if (!election || !candidate) {
//       return res
//         .status(404)
//         .json({ error: "Election or candidate not found." });
//     }

//     // Ensure candidate is part of this election
//     const isParticipant = election.candidates.some(
//       (c) => c._id.toString() === candidate._id.toString()
//     );

//     if (!isParticipant) {
//       return res
//         .status(400)
//         .json({ error: "Candidate did not participate in this election." });
//     }

//     // Fetch votes for this candidate in this election
//     const Vote = require("../models/Vote");
//     const votes = await Vote.find({
//       election: electionId,
//       candidate: candidateId,
//       rejected: { $ne: true },
//     });

//     const rejections = await Vote.find({
//       election: electionId,
//       candidate: candidateId,
//       rejected: true,
//     });

//     const createdSections = [];

//     for (const title of insightTitles) {
//       const existingSection = election.insightSections?.find(
//         (section) => section.title === title
//       );

//       // Optionally skip if already exists
//       if (existingSection) continue;

//       const section = await generateInsightSection({
//         election,
//         candidate,
//         votes,
//         rejections,
//         title,
//       });

//       createdSections.push(section);
//     }

//     res.json({
//       message: "Insights generated successfully",
//       sections: createdSections,
//     });
//   } catch (error) {
//     console.error("Error generating insights:", error);
//     res.status(500).json({ error: "Failed to generate insights." });
//   }
// };

const Election = require("../models/Election");
const Candidate = require("../models/Candidate");
const generateInsightSection = require("../utils/generateInsightSection");

const insightTitles = [
  "Demographic Profile",
  "Educational Journey",
  "Living Context",
  "Economic Factors",
  "Policy Awareness & Political Behavior",
  "Sentiment & Expectations",
];

exports.generateAllInsightsForCandidate = async (req, res) => {
  try {
    // // ✅ UNCOMMENT these two lines!
    // const electionId = req.params.id;
    // const candidateId = req.user._id; // assuming authenticated candidate

    // console.log(electionId);
    // console.log(candidateId);

    // const [election, candidate] = await Promise.all([
    //   Election.findById(electionId)
    //     .select("candidates insightSections")
    //     .populate("candidates", "_id"), // populate only _id
    //   Candidate.findById(candidateId),
    // ]);

    const electionId = req.params.id;
    const candidateId = req.user?._id || req.body.candidateId; // fallback if needed

    console.log("Election ID:", electionId);
    console.log("Candidate ID:", candidateId);

    if (!candidateId) {
      return res.status(401).json({ error: "Candidate not authenticated." });
    }

    const [election, candidate] = await Promise.all([
      Election.findById(electionId)
        .select("candidates insightSections")
        .populate("candidates", "_id"),
      Candidate.findById(candidateId),
    ]);

    if (!election || !candidate) {
      return res
        .status(404)
        .json({ error: "Election or candidate not found." });
    }

    // Ensure candidate is part of this election
    const isParticipant = election.candidates.some(
      (c) => c._id.toString() === candidate._id.toString()
    );

    if (!isParticipant) {
      return res
        .status(400)
        .json({ error: "Candidate did not participate in this election." });
    }

    // Fetch votes for this candidate in this election
    const Vote = require("../models/Vote");
    const votes = await Vote.find({
      election: electionId,
      candidate: candidateId,
      rejected: { $ne: true },
    });

    const rejections = await Vote.find({
      election: electionId,
      candidate: candidateId,
      rejected: true,
    });

    const createdSections = [];

    for (const title of insightTitles) {
      const existingSection = election.insightSections?.find(
        (section) => section.title === title
      );

      // Optionally skip if already exists
      if (existingSection) continue;

      const section = await generateInsightSection({
        election,
        candidate,
        votes,
        rejections,
        title,
      });

      createdSections.push(section);
    }

    res.json({
      message: "Insights generated successfully",
      sections: createdSections,
    });
  } catch (error) {
    console.error("Error generating insights:", error);
    res.status(500).json({ error: "Failed to generate insights." });
  }
};
