const Vote = require("../models/Vote");
const Rejection = require("../models/Rejection");
const Election = require("../models/Election");

// Fixed import (Option 1):
const { generateInsightPDF } = require("../utils/pdfGenerator");
const { bucket } = require("../utils/uploadToGCS.js");
const fs = require("fs");
const path = require("path");
const { pdfGenerator } = require("../utils/pdfGenerator");

// First, make sure you have this at the top of your file (with your actual API key)
const OpenAI = require("openai");
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Make sure this is in your .env file
});

// exports.generateReport = async (req, res) => {

// backend/controllers/insightsController.js

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

    // Render the report template with necessary values
    res.render("insights/report", {
      election,
      stats,
      currentCandidateId: candidateId.toString(),
    });
  } catch (error) {
    console.error("Error generating report:", error);
    res.status(500).send("Failed to generate report.");
  }
};

// //Export Demographic Analisis

exports.generateDemographicInsight = async (req, res) => {
  try {
    const { id: electionId } = req.params;
    const candidateId = req.user.candidate._id.toString(); // Ensure it's a string for map keys

    // Fetch and validate election
    const election = await Election.findById(electionId);
    if (!election) return res.status(404).send("Election not found");

    const isCandidate = election.candidates.some((c) => c.equals(candidateId));
    if (!isCandidate) return res.status(403).send("Access denied");

    // Fetch votes and rejections
    const votes = await Vote.find({
      election: electionId,
      candidate: candidateId,
    });
    let rejections = [];

    try {
      rejections = await Rejection.find({ election: electionId });
    } catch (err) {
      console.warn(
        "No rejections found or failed to fetch rejections:",
        err.message
      );
    }

    // Define relevant demographic fields
    const demographicFields = ["age", "gender", "maritalStatus"];

    // Extract fields from votes
    const extractedVotes = votes.map((vote) =>
      demographicFields.reduce((acc, field) => {
        acc[field] = vote[field] ?? null;
        return acc;
      }, {})
    );

    // Extract fields from rejections
    const extractedRejections = rejections.map((rej) =>
      demographicFields.reduce((acc, field) => {
        acc[field] = rej[field] ?? null;
        return acc;
      }, {})
    );

    // Compose OpenAI prompt
    const prompt = `You are a professional election analyst. Analyze the demographic profile of voters and non-voters (rejections) based on the following data.

Voter Records:
${JSON.stringify(extractedVotes, null, 2)}

Rejection Records:
${JSON.stringify(extractedRejections, null, 2)}

Focus on identifying patterns or differences across age, gender, and marital status. Your report should be approximately 250–500 words and written in a professional, objective tone.`;

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const aiContent = completion.choices[0].message.content.trim();

    // Save insight into the election.aiInsights[candidateId]["Demographic Profile"]
    if (!election.aiInsights.has(candidateId)) {
      election.aiInsights.set(candidateId, {});
    }

    const candidateInsights = election.aiInsights.get(candidateId);
    candidateInsights["Demographic Profile"] = aiContent;
    election.aiInsights.set(candidateId, candidateInsights);

    await election.save();

    // 💾 PDF Generation
    const fileName = `demographic_${electionId}_${candidateId}.pdf`;
    const localPath = path.join(__dirname, `../pdfs/${fileName}`);
    const storagePath = `allinsights/${fileName}`;

    await generateInsightPDF({
      title: "Demographic Profile",
      content: aiContent,
      filePath: localPath,
    });

    // ⬆️ Upload to GCS
    await bucket.upload(localPath, {
      destination: storagePath,
      gzip: true,
      metadata: {
        cacheControl: "public, max-age=31536000",
      },
    });

    // 🧹 Clean up local file
    fs.unlink(localPath, (err) => {
      if (err) console.warn("Failed to delete local PDF:", err);
    });

    // ✅ Final redirect after save
    res.redirect(`/api/insights/${electionId}/report`);
  } catch (err) {
    console.error("Error generating insight:", err);

    if (err.response) {
      console.error("API Error:", err.response.status, err.response.data);
    }

    res.redirect(`/api/insights/${req.params.id}/report`);
  }
};

exports.generateEducationalInsight = async (req, res) => {
  try {
    const { id: electionId } = req.params;
    const candidateId = req.user.candidate._id.toString();

    const election = await Election.findById(electionId);
    if (!election) return res.status(404).send("Election not found");

    const isCandidate = election.candidates.some((c) => c.equals(candidateId));
    if (!isCandidate) return res.status(403).send("Access denied");

    const votes = await Vote.find({
      election: electionId,
      candidate: candidateId,
    });
    let rejections = [];

    try {
      rejections = await Rejection.find({ election: electionId });
    } catch (err) {
      console.warn(
        "No rejections found or failed to fetch rejections:",
        err.message
      );
    }

    const educationFields = [
      "highestEducation",
      "provinceOfStudy",
      "schoolCompletionLocation",
    ];

    const extractedVotes = votes.map((vote) =>
      educationFields.reduce((acc, field) => {
        acc[field] = vote[field] ?? null;
        return acc;
      }, {})
    );

    const extractedRejections = rejections.map((rej) =>
      educationFields.reduce((acc, field) => {
        acc[field] = rej[field] ?? null;
        return acc;
      }, {})
    );

    const prompt = `You are a political analyst specializing in voter education data. Analyze the educational backgrounds of voters and rejections in this election. Highlight trends, differences, or insights based on:

- Highest level of education
- Province of study
- School completion location

Voter Records:
${JSON.stringify(extractedVotes, null, 2)}

Rejection Records:
${JSON.stringify(extractedRejections, null, 2)}

Provide a 250–500 word narrative that could help the candidate refine their messaging to match voter education levels. Use a professional, insightful tone.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const aiContent = completion.choices[0].message.content.trim();

    if (!election.aiInsights.has(candidateId)) {
      election.aiInsights.set(candidateId, {});
    }

    const candidateInsights = election.aiInsights.get(candidateId);
    candidateInsights["Educational Journey"] = aiContent;
    election.aiInsights.set(candidateId, candidateInsights);

    await election.save();

    // 💾 PDF Generation
    const fileName = `education_${electionId}_${candidateId}.pdf`;
    const localPath = path.join(__dirname, `../pdfs/${fileName}`);
    const storagePath = `allinsights/${fileName}`;

    await generateInsightPDF({
      title: "Educational Journey",
      content: aiContent,
      filePath: localPath,
    });

    // ⬆️ Upload to GCS
    await bucket.upload(localPath, {
      destination: storagePath,
      gzip: true,
      metadata: {
        cacheControl: "public, max-age=31536000",
      },
    });

    // 🧹 Clean up local file
    fs.unlink(localPath, (err) => {
      if (err) console.warn("Failed to delete local PDF:", err);
    });

    res.redirect(`/api/insights/${electionId}/report`);
  } catch (err) {
    console.error("Error generating educational insight:", err);

    if (err.response) {
      console.error("API Error:", err.response.status, err.response.data);
    }

    res.redirect(`/api/insights/${req.params.id}/report`);
  }
};

exports.generateLivingInsight = async (req, res) => {
  try {
    const { id: electionId } = req.params;
    const candidateId = req.user.candidate._id.toString();

    const election = await Election.findById(electionId);
    if (!election) return res.status(404).send("Election not found");

    const isCandidate = election.candidates.some((c) => c.equals(candidateId));
    if (!isCandidate) return res.status(403).send("Access denied");

    const votes = await Vote.find({
      election: electionId,
      candidate: candidateId,
    });
    let rejections = [];

    try {
      rejections = await Rejection.find({ election: electionId });
    } catch (err) {
      console.warn(
        "No rejections found or failed to fetch rejections:",
        err.message
      );
    }

    const livingFields = [
      "dwellingType",
      "familyDwellingType",
      "district",
      "constituency",
    ];

    const extractedVotes = votes.map((vote) =>
      livingFields.reduce((acc, field) => {
        acc[field] = vote[field] ?? null;
        return acc;
      }, {})
    );

    const extractedRejections = rejections.map((rej) =>
      livingFields.reduce((acc, field) => {
        acc[field] = rej[field] ?? null;
        return acc;
      }, {})
    );

    const prompt = `You are a political analyst reviewing the living context of voters and rejections in this election. Analyze the following data with a focus on:

- Dwelling type (urban vs rural)
- Family dwelling type
- District and constituency patterns

Voter Records:
${JSON.stringify(extractedVotes, null, 2)}

Rejection Records:
${JSON.stringify(extractedRejections, null, 2)}

Provide a 250–500 word analysis identifying key patterns, trends, or differences. Offer insights that can help a candidate better understand voters' living environments. Use a professional tone suitable for campaign strategy.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const aiContent = completion.choices[0].message.content.trim();

    if (!election.aiInsights.has(candidateId)) {
      election.aiInsights.set(candidateId, {});
    }

    const candidateInsights = election.aiInsights.get(candidateId);
    candidateInsights["Living Context"] = aiContent;
    election.aiInsights.set(candidateId, candidateInsights);

    await election.save();

    // 💾 PDF Generation
    const fileName = `living_${electionId}_${candidateId}.pdf`;
    const localPath = path.join(__dirname, `../pdfs/${fileName}`);
    const storagePath = `allinsights/${fileName}`;

    await generateInsightPDF({
      title: "Living Context",
      content: aiContent,
      filePath: localPath,
    });

    // ⬆️ Upload to GCS
    await bucket.upload(localPath, {
      destination: storagePath,
      gzip: true,
      metadata: {
        cacheControl: "public, max-age=31536000",
      },
    });

    // 🧹 Clean up local file
    fs.unlink(localPath, (err) => {
      if (err) console.warn("Failed to delete local PDF:", err);
    });

    res.redirect(`/api/insights/${electionId}/report`);
  } catch (err) {
    console.error("Error generating living context insight:", err);

    if (err.response) {
      console.error("API Error:", err.response.status, err.response.data);
    }

    res.redirect(`/api/insights/${req.params.id}/report`);
  }
};

exports.generateEconomicInsight = async (req, res) => {
  try {
    const { id: electionId } = req.params;
    const candidateId = req.user.candidate._id.toString();

    const election = await Election.findById(electionId);
    if (!election) return res.status(404).send("Election not found");

    const isCandidate = election.candidates.some((c) => c.equals(candidateId));
    if (!isCandidate) return res.status(403).send("Access denied");

    const votes = await Vote.find({
      election: electionId,
      candidate: candidateId,
    });
    let rejections = [];

    try {
      rejections = await Rejection.find({ election: electionId });
    } catch (err) {
      console.warn(
        "No rejections found or failed to fetch rejections:",
        err.message
      );
    }

    const economicFields = [
      "averageMonthlyRent",
      "employmentStatus",
      "sectorOfOperation",
    ];

    const extractedVotes = votes.map((vote) =>
      economicFields.reduce((acc, field) => {
        acc[field] = vote[field] ?? null;
        return acc;
      }, {})
    );

    const extractedRejections = rejections.map((rej) =>
      economicFields.reduce((acc, field) => {
        acc[field] = rej[field] ?? null;
        return acc;
      }, {})
    );

    const prompt = `Analyze the economic status of voters and rejections based on:

- Average monthly rent
- Employment status
- Sector of operation (e.g., marketeer, small business, etc.)

Voter Records:
${JSON.stringify(extractedVotes, null, 2)}

Rejection Records:
${JSON.stringify(extractedRejections, null, 2)}

Write a 250–500 word narrative giving insight into economic conditions and what this means for the candidate's messaging strategy. Use a professional and strategic tone.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const aiContent = completion.choices[0].message.content.trim();

    if (!election.aiInsights.has(candidateId)) {
      election.aiInsights.set(candidateId, {});
    }

    const candidateInsights = election.aiInsights.get(candidateId);
    candidateInsights["Economic Factors"] = aiContent;
    election.aiInsights.set(candidateId, candidateInsights);

    await election.save();

    // 💾 PDF Generation
    const fileName = `economy_${electionId}_${candidateId}.pdf`;
    const localPath = path.join(__dirname, `../pdfs/${fileName}`);
    const storagePath = `allinsights/${fileName}`;

    await pdfGenerator.generateInsightPDF({
      title: "Economic Factors",
      content: aiContent,
      filePath: localPath,
    });

    // ⬆️ Upload to GCS
    await bucket.upload(localPath, {
      destination: storagePath,
      gzip: true,
      metadata: {
        cacheControl: "public, max-age=31536000",
      },
    });

    // 🧹 Clean up local file
    fs.unlink(localPath, (err) => {
      if (err) console.warn("Failed to delete local PDF:", err);
    });

    res.redirect(`/api/insights/${electionId}/report`);
  } catch (err) {
    console.error("Error generating economic insight:", err);
    res.redirect(`/api/insights/${req.params.id}/report`);
  }
};

exports.generatePolicyInsight = async (req, res) => {
  try {
    const { id: electionId } = req.params;
    const candidateId = req.user.candidate._id.toString();

    const election = await Election.findById(electionId);
    if (!election) return res.status(404).send("Election not found");

    const isCandidate = election.candidates.some((c) => c.equals(candidateId));
    if (!isCandidate) return res.status(403).send("Access denied");

    const votes = await Vote.find({
      election: electionId,
      candidate: candidateId,
    });
    let rejections = [];

    try {
      rejections = await Rejection.find({ election: electionId });
    } catch (err) {
      console.warn(
        "No rejections found or failed to fetch rejections:",
        err.message
      );
    }

    const policyFields = [
      "familiarWithPolicies",
      "policyUnderstanding",
      "usualPartySupport",
    ];

    const extractedVotes = votes.map((vote) =>
      policyFields.reduce((acc, field) => {
        acc[field] = vote[field] ?? null;
        return acc;
      }, {})
    );

    const extractedRejections = rejections.map((rej) =>
      policyFields.reduce((acc, field) => {
        acc[field] = rej[field] ?? null;
        return acc;
      }, {})
    );

    const prompt = `Analyze the political awareness and behavior of voters and rejections based on:

- Familiarity with candidate policies
- Policy understanding
- Usual party support

Voter Records:
${JSON.stringify(extractedVotes, null, 2)}

Rejection Records:
${JSON.stringify(extractedRejections, null, 2)}

Provide a 250–500 word insight helping the candidate understand policy reach and voter behavior patterns. Use a political analysis tone.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const aiContent = completion.choices[0].message.content.trim();

    if (!election.aiInsights.has(candidateId)) {
      election.aiInsights.set(candidateId, {});
    }

    const candidateInsights = election.aiInsights.get(candidateId);
    candidateInsights["Policy Awareness & Political Behavior"] = aiContent;
    election.aiInsights.set(candidateId, candidateInsights);

    await election.save();

    // 💾 PDF Generation
    const fileName = `policy_${electionId}_${candidateId}.pdf`;
    const localPath = path.join(__dirname, `../pdfs/${fileName}`);
    const storagePath = `allinsight/${fileName}`;

    await generateInsightPDF({
      title: "Policy Awareness & Political Behavior",
      content: aiContent,
      filePath: localPath,
    });

    // ⬆️ Upload to GCS
    await bucket.upload(localPath, {
      destination: storagePath,
      gzip: true,
      metadata: {
        cacheControl: "public, max-age=31536000",
      },
    });

    // 🧹 Clean up local file
    fs.unlink(localPath, (err) => {
      if (err) console.warn("Failed to delete local PDF:", err);
    });

    res.redirect(`/api/insights/${electionId}/report`);
  } catch (err) {
    console.error("Error generating policy insight:", err);
    res.redirect(`/api/insights/${req.params.id}/report`);
  }
};

exports.generateSentimentInsight = async (req, res) => {
  try {
    const { id: electionId } = req.params;
    const candidateId = req.user.candidate._id.toString();

    const election = await Election.findById(electionId);
    if (!election) return res.status(404).send("Election not found");

    const isCandidate = election.candidates.some((c) => c.equals(candidateId));
    if (!isCandidate) return res.status(403).send("Access denied");

    const votes = await Vote.find({
      election: electionId,
      candidate: candidateId,
    });
    let rejections = [];

    try {
      rejections = await Rejection.find({ election: electionId });
    } catch (err) {
      console.warn(
        "No rejections found or failed to fetch rejections:",
        err.message
      );
    }

    const sentimentFields = [
      "dislikesAboutCandidate",
      "expectationsFromCandidate",
      "reasonForVoting",
    ];

    const extractedVotes = votes.map((vote) =>
      sentimentFields.reduce((acc, field) => {
        acc[field] = vote[field] ?? null;
        return acc;
      }, {})
    );

    const extractedRejections = rejections.map((rej) =>
      sentimentFields.reduce((acc, field) => {
        acc[field] = rej[field] ?? null;
        return acc;
      }, {})
    );

    const prompt = `Analyze voter sentiment and expectations using the following fields:

- What voters dislike about the candidate
- What they expect from the candidate
- Their reason for voting

Voter Records:
${JSON.stringify(extractedVotes, null, 2)}

Rejection Records:
${JSON.stringify(extractedRejections, null, 2)}

Craft a 250–500 word strategic insight to help the candidate improve messaging and address voter concerns. Use a thoughtful, campaign-aligned tone.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const aiContent = completion.choices[0].message.content.trim();

    if (!election.aiInsights.has(candidateId)) {
      election.aiInsights.set(candidateId, {});
    }

    const candidateInsights = election.aiInsights.get(candidateId);
    candidateInsights["Sentiment & Expectations"] = aiContent;
    election.aiInsights.set(candidateId, candidateInsights);

    await election.save();

    // 💾 PDF Generation
    const fileName = `sentiments_${electionId}_${candidateId}.pdf`;
    const localPath = path.join(__dirname, `../pdfs/${fileName}`);
    const storagePath = `allinsights/${fileName}`;

    await generateInsightPDF({
      title: "Sentiment & Expectations",
      content: aiContent,
      filePath: localPath,
    });

    // ⬆️ Upload to GCS
    await bucket.upload(localPath, {
      destination: storagePath,
      gzip: true,
      metadata: {
        cacheControl: "public, max-age=31536000",
      },
    });

    // 🧹 Clean up local file
    fs.unlink(localPath, (err) => {
      if (err) console.warn("Failed to delete local PDF:", err);
    });

    res.redirect(`/api/insights/${electionId}/report`);
  } catch (err) {
    console.error("Error generating sentiment insight:", err);
    res.redirect(`/api/insights/${req.params.id}/report`);
  }
};
