const Vote = require("../models/Vote");
const Rejection = require("../models/Rejection");
const Election = require("../models/Election");
const Candidate = require("../models/Candidate");

exports.generateReport = async (req, res) => {
  try {
    const electionId = req.params.id;
    const candidateId = req.user.candidate._id;

    const election = await Election.findById(electionId).populate("candidates");

    // Verify candidate is part of this election
    const isParticipant = election.candidates.some((c) =>
      c._id.equals(candidateId)
    );
    if (!isParticipant) return res.status(403).send("Access denied");

    // Votes for this candidate
    const myVotes = await Vote.find({
      election: electionId,
      candidate: candidateId,
    });

    // Votes for other candidates
    const otherVoteCounts = {};
    for (const other of election.candidates) {
      const count = await Vote.countDocuments({
        election: electionId,
        candidate: other._id,
      });
      otherVoteCounts[other._id] = {
        name: other.name,
        votes: count,
        isSelf: other._id.equals(candidateId),
      };
    }

    // Rejections (only relevant in single-candidate or opt-in rejections)
    const rejections = await Rejection.find({ election: electionId });

    // --- ANALYSIS BLOCK ---
    const stats = {
      totalVotesForMe: myVotes.length,
      totalRejections: rejections.length,
      totalElectionVotes: Object.values(otherVoteCounts).reduce(
        (acc, val) => acc + val.votes,
        0
      ),
      demographics: {
        ageGroups: {},
        education: {},
        gender: {},
        maritalStatus: {},
        religiousStatus: {},
        employmentStatus: {},
        dwellingType: {},
        familyDwellingType: {},
        sectorOfOperation: {},
        provinceOfStudy: {},
        schoolCompletionLocation: {},
        district: {},
        constituency: {},
      },
      sentiment: {
        dislikes: [],
        expectations: [],
        reasonForVoting: [],
        usualPartySupport: [],
        relativeInfluence: [],
        policyKnowledge: {
          familiar: 0,
          unfamiliar: 0,
          comments: [],
        },
      },
      rejections: {
        reasons: [],
        demographics: {
          ageGroups: {},
          education: {},
          gender: {},
          religiousStatus: {},
          sectorOfOperation: {},
        },
      },
    };

    // Analyze Votes
    for (const vote of myVotes) {
      const ageGroup = Math.floor(vote.age / 10) * 10 + "s";
      stats.demographics.ageGroups[ageGroup] =
        (stats.demographics.ageGroups[ageGroup] || 0) + 1;

      const fields = [
        "gender",
        "highestEducation",
        "maritalStatus",
        "religiousStatus",
        "employmentStatus",
        "dwellingType",
        "familyDwellingType",
        "sectorOfOperation",
        "provinceOfStudy",
        "schoolCompletionLocation",
        "district",
        "constituency",
      ];

      fields.forEach((field) => {
        const value = vote[field];
        if (value) {
          stats.demographics[field] = stats.demographics[field] || {};
          stats.demographics[field][value] =
            (stats.demographics[field][value] || 0) + 1;
        }
      });

      if (vote.dislikesAboutCandidate)
        stats.sentiment.dislikes.push(vote.dislikesAboutCandidate);
      if (vote.expectationsFromCandidate)
        stats.sentiment.expectations.push(vote.expectationsFromCandidate);
      if (vote.reasonForVoting)
        stats.sentiment.reasonForVoting.push(vote.reasonForVoting);
      if (vote.usualPartySupport)
        stats.sentiment.usualPartySupport.push(vote.usualPartySupport);
      if (vote.reasonForRelativeVote)
        stats.sentiment.relativeInfluence.push(vote.reasonForRelativeVote);

      if (vote.familiarWithPolicies) {
        stats.sentiment.policyKnowledge.familiar += 1;
      } else {
        stats.sentiment.policyKnowledge.unfamiliar += 1;
      }

      if (vote.policyUnderstanding) {
        stats.sentiment.policyKnowledge.comments.push(vote.policyUnderstanding);
      }
    }

    // Analyze Rejections
    for (const rej of rejections) {
      if (rej.reason) stats.rejections.reasons.push(rej.reason);

      const ageGroup = rej.age ? Math.floor(rej.age / 10) * 10 + "s" : null;
      if (ageGroup)
        stats.rejections.demographics.ageGroups[ageGroup] =
          (stats.rejections.demographics.ageGroups[ageGroup] || 0) + 1;

      const rejectionFields = [
        "gender",
        "highestEducation",
        "religiousStatus",
        "sectorOfOperation",
      ];
      rejectionFields.forEach((field) => {
        const value = rej[field];
        if (value) {
          stats.rejections.demographics[field] =
            stats.rejections.demographics[field] || {};
          stats.rejections.demographics[field][value] =
            (stats.rejections.demographics[field][value] || 0) + 1;
        }
      });
    }

    // --- DONE ---

    res.render("insights/report", {
      election,
      stats,
      candidateId,
      voteDistribution: otherVoteCounts,
    });
  } catch (error) {
    console.error("Error generating insights:", error);
    res.status(500).send("Failed to generate insights.");
  }
};
