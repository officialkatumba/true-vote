const Vote = require("../models/Vote");
const Rejection = require("../models/Rejection");
const Election = require("../models/Election");

// Fixed import (Option 1):
const { generateInsightPDF } = require("../utils/pdfGenerator");
// const { bucket } = require("../utils/uploadToGCS.js");
const uploadPDFToGCS = require("../utils/uploadToGCS.js");

const fs = require("fs");
const path = require("path");

// First, make sure you have this at the top of your file (with your actual API key)
const OpenAI = require("openai");
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Make sure this is in your .env file
});

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

    // Convert aiInsights Map to plain object for EJS
    const aiInsights = election.aiInsights.get(candidateId.toString());

    // Render the report template with necessary values
    res.render("insights/report", {
      election: {
        ...election.toObject(),
        aiInsights: election.aiInsights, // Keep as Map for .get() in template
      },
      stats,
      currentCandidateId: candidateId.toString(),
    });
  } catch (error) {
    console.error("Error generating report:", error);
    res.status(500).send("Failed to generate report.");
  }
};

//////////////////////////////////////////////

const { Storage } = require("@google-cloud/storage");

// Initialize Google Cloud Storage with explicit credentials
const storage = new Storage({
  keyFilename: path.join(__dirname, "../key.json"),
  projectId: "truevote-458711",
});
const bucket = storage.bucket("truevote-insight");

exports.generateDemographicInsight = async (req, res) => {
  try {
    const { id: electionId } = req.params;
    const candidateId = req.user.candidate._id.toString();

    // 1. Fetch and validate election
    const election = await Election.findById(electionId);
    if (!election) return res.status(404).send("Election not found");

    const isCandidate = election.candidates.some((c) => c.equals(candidateId));
    if (!isCandidate) return res.status(403).send("Access denied");

    // 2. Fetch votes and rejections
    const votes = await Vote.find({
      election: electionId,
      candidate: candidateId,
    });

    let rejections = [];
    try {
      rejections = await Rejection.find({ election: electionId });
    } catch (err) {
      console.warn("No rejections found or failed to fetch:", err.message);
    }

    // 3. Prepare demographic data
    const demographicFields = ["age", "gender", "maritalStatus"];
    const extractedVotes = votes.map((vote) =>
      demographicFields.reduce((acc, field) => {
        acc[field] = vote[field] ?? null;
        return acc;
      }, {})
    );

    const extractedRejections = rejections.map((rej) =>
      demographicFields.reduce((acc, field) => {
        acc[field] = rej[field] ?? null;
        return acc;
      }, {})
    );

    // 4. Generate AI analysis
    const prompt = `You are a professional election analyst. Analyze the demographic profile of voters and non-voters (rejections) based on the following data.

Voter Records:
${JSON.stringify(extractedVotes, null, 2)}

Rejection Records:
${JSON.stringify(extractedRejections, null, 2)}

Focus on identifying patterns or differences across age, gender, and marital status. Your report should be approximately 250-500 words and written in a professional, objective tone.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const aiContent = completion.choices[0].message.content.trim();

    // 5. Store insights in election document
    if (!election.aiInsights.has(candidateId)) {
      election.aiInsights.set(candidateId, {});
    }

    const candidateInsights = election.aiInsights.get(candidateId);
    candidateInsights["Demographic Profile"] = {
      content: aiContent,
      pdfUploaded: false,
    };
    await election.save();

    // 6. Generate and upload PDF
    const fileName = `demographic_${electionId}_${candidateId}.pdf`;
    const localPath = path.join(__dirname, `../pdfs/${fileName}`);
    const storagePath = `allinsights/${fileName}`;

    // Ensure pdfs directory exists
    if (!fs.existsSync(path.dirname(localPath))) {
      fs.mkdirSync(path.dirname(localPath), { recursive: true });
    }

    try {
      // Generate PDF locally
      await generateInsightPDF({
        sectionTitle: "Demographic Profile",
        content: aiContent,
        filePath: localPath,
        electionDetails: {
          type: election.type,
          electionNumber: election.electionNumber,
          startDate: election.endDate,
        },
      });

      // Verify bucket access
      const [bucketExists] = await bucket.exists();
      if (!bucketExists) {
        throw new Error("Bucket does not exist or no access permissions");
      }

      // Upload to GCS
      await bucket.upload(localPath, {
        destination: storagePath,
        gzip: true,
        metadata: {
          cacheControl: "public, max-age=31536000",
        },
      });

      // Update status
      const updatedCandidateInsights = election.aiInsights.get(candidateId);
      updatedCandidateInsights["Demographic Profile"].pdfUploaded = true;
      election.aiInsights.set(candidateId, updatedCandidateInsights);
      await election.save();

      console.log(`PDF successfully uploaded to ${storagePath}`);
    } catch (uploadError) {
      console.error("PDF processing failed:", {
        error: uploadError.message,
        stack: uploadError.stack,
      });

      // Mark as not uploaded but continue
      const updatedCandidateInsights = election.aiInsights.get(candidateId);
      updatedCandidateInsights["Demographic Profile"].pdfUploaded = false;
      election.aiInsights.set(candidateId, updatedCandidateInsights);
      await election.save();
    }

    // Clean up local file
    if (fs.existsSync(localPath)) {
      fs.unlink(localPath, (err) => {
        if (err) console.warn("Failed to delete local PDF:", err);
      });
    }

    res.redirect(`/api/insights/${electionId}/report`);
  } catch (err) {
    console.error("Error in generateDemographicInsight:", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).redirect(`/api/insights/${req.params.id}/report`);
  }
};

// const path = require("path");
// const fs = require("fs");
// const { Storage } = require("@google-cloud/storage");
// const openai = require("../utils/openai"); // Adjust if needed
// const generateInsightPDF = require("../utils/pdfGenerator"); // Adjust if needed

// const storage = new Storage({
//   keyFilename: path.join(__dirname, "../key.json"),
//   projectId: "truevote-458711",
// });
// const bucket = storage.bucket("truevote-insight");

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
      console.warn("No rejections found or failed to fetch:", err.message);
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
    candidateInsights["Educational Journey"] = {
      content: aiContent,
      pdfUploaded: false,
    };
    await election.save();

    const fileName = `education_${electionId}_${candidateId}.pdf`;
    const localPath = path.join(__dirname, `../pdfs/${fileName}`);
    const storagePath = `allinsights/${fileName}`;

    if (!fs.existsSync(path.dirname(localPath))) {
      fs.mkdirSync(path.dirname(localPath), { recursive: true });
    }

    try {
      await generateInsightPDF({
        sectionTitle: "Educational Journey",
        content: aiContent,
        filePath: localPath,
        electionDetails: {
          type: election.type,
          electionNumber: election.electionNumber,
          startDate: election.endDate,
        },
      });

      const [bucketExists] = await bucket.exists();
      if (!bucketExists)
        throw new Error("Bucket does not exist or no access permissions");

      await bucket.upload(localPath, {
        destination: storagePath,
        gzip: true,
        metadata: {
          cacheControl: "public, max-age=31536000",
        },
      });

      const updated = election.aiInsights.get(candidateId);
      updated["Educational Journey"].pdfUploaded = true;
      election.aiInsights.set(candidateId, updated);
      await election.save();

      console.log(`Educational PDF successfully uploaded to ${storagePath}`);
    } catch (uploadError) {
      console.error("Educational PDF processing failed:", uploadError.message);

      const updated = election.aiInsights.get(candidateId);
      updated["Educational Journey"].pdfUploaded = false;
      election.aiInsights.set(candidateId, updated);
      await election.save();
    }

    if (fs.existsSync(localPath)) {
      fs.unlink(localPath, (err) => {
        if (err) console.warn("Failed to delete local PDF:", err);
      });
    }

    res.redirect(`/api/insights/${electionId}/report`);
  } catch (err) {
    console.error("Error in generateEducationalInsight:", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).redirect(`/api/insights/${req.params.id}/report`);
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
    candidateInsights["Living Context"] = {
      content: aiContent,
      pdfUploaded: false,
    };
    election.aiInsights.set(candidateId, candidateInsights);
    await election.save();

    const fileName = `living_${electionId}_${candidateId}.pdf`;
    const localPath = path.join(__dirname, `../pdfs/${fileName}`);
    const storagePath = `allinsights/${fileName}`;

    if (!fs.existsSync(path.dirname(localPath))) {
      fs.mkdirSync(path.dirname(localPath), { recursive: true });
    }

    try {
      await generateInsightPDF({
        sectionTitle: "Living Context",
        content: aiContent,
        filePath: localPath,
        electionDetails: {
          type: election.type,
          electionNumber: election.electionNumber,
          startDate: election.endDate,
        },
      });

      const [bucketExists] = await bucket.exists();
      if (!bucketExists)
        throw new Error("Bucket does not exist or access denied");

      await bucket.upload(localPath, {
        destination: storagePath,
        gzip: true,
        metadata: {
          cacheControl: "public, max-age=31536000",
        },
      });

      const updatedCandidateInsights = election.aiInsights.get(candidateId);
      updatedCandidateInsights["Living Context"].pdfUploaded = true;
      election.aiInsights.set(candidateId, updatedCandidateInsights);
      await election.save();

      console.log(`Living Context PDF uploaded: ${storagePath}`);
    } catch (uploadErr) {
      console.error("PDF Upload or Generation Error:", uploadErr.message);

      const updatedCandidateInsights = election.aiInsights.get(candidateId);
      updatedCandidateInsights["Living Context"].pdfUploaded = false;
      election.aiInsights.set(candidateId, updatedCandidateInsights);
      await election.save();
    }

    if (fs.existsSync(localPath)) {
      fs.unlink(localPath, (err) => {
        if (err) console.warn("Failed to delete local PDF:", err);
      });
    }

    res.redirect(`/api/insights/${electionId}/report`);
  } catch (err) {
    console.error("Error generating living insight:", err);
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
      console.warn("No rejections found or failed to fetch:", err.message);
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
    candidateInsights["Economic Factors"] = {
      content: aiContent,
      pdfUploaded: false,
    };
    election.aiInsights.set(candidateId, candidateInsights);
    await election.save();

    const fileName = `economy_${electionId}_${candidateId}.pdf`;
    const localPath = path.join(__dirname, `../pdfs/${fileName}`);
    const storagePath = `allinsights/${fileName}`;

    if (!fs.existsSync(path.dirname(localPath))) {
      fs.mkdirSync(path.dirname(localPath), { recursive: true });
    }

    try {
      await generateInsightPDF({
        sectionTitle: "Economic Factors",
        content: aiContent,
        filePath: localPath,
        electionDetails: {
          type: election.type,
          electionNumber: election.electionNumber,
          startDate: election.endDate,
        },
      });

      const [bucketExists] = await bucket.exists();
      if (!bucketExists) {
        throw new Error("Bucket does not exist or no access permissions");
      }

      await bucket.upload(localPath, {
        destination: storagePath,
        gzip: true,
        metadata: {
          cacheControl: "public, max-age=31536000",
        },
      });

      const updatedInsights = election.aiInsights.get(candidateId);
      updatedInsights["Economic Factors"].pdfUploaded = true;
      election.aiInsights.set(candidateId, updatedInsights);
      await election.save();

      console.log(`PDF uploaded: ${storagePath}`);
    } catch (uploadError) {
      console.error("PDF upload failed:", uploadError.message);
      const updatedInsights = election.aiInsights.get(candidateId);
      updatedInsights["Economic Factors"].pdfUploaded = false;
      election.aiInsights.set(candidateId, updatedInsights);
      await election.save();
    }

    if (fs.existsSync(localPath)) {
      fs.unlink(localPath, (err) => {
        if (err) console.warn("Failed to delete PDF:", err);
      });
    }

    res.redirect(`/api/insights/${electionId}/report`);
  } catch (err) {
    console.error("Error in generateEconomicInsight:", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).redirect(`/api/insights/${req.params.id}/report`);
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
      console.warn("No rejections found or failed to fetch:", err.message);
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
    candidateInsights["Policy Awareness & Political Behavior"] = {
      content: aiContent,
      pdfUploaded: false,
    };
    await election.save();

    const fileName = `policy_${electionId}_${candidateId}.pdf`;
    const localPath = path.join(__dirname, `../pdfs/${fileName}`);
    const storagePath = `allinsights/${fileName}`;

    if (!fs.existsSync(path.dirname(localPath))) {
      fs.mkdirSync(path.dirname(localPath), { recursive: true });
    }

    try {
      await generateInsightPDF({
        sectionTitle: "Policy Awareness & Political Behavior",
        content: aiContent,
        filePath: localPath,
        electionDetails: {
          type: election.type,
          electionNumber: election.electionNumber,
          startDate: election.endDate,
        },
      });

      await bucket.upload(localPath, {
        destination: storagePath,
        gzip: true,
        metadata: { cacheControl: "public, max-age=31536000" },
      });

      const updatedCandidateInsights = election.aiInsights.get(candidateId);
      updatedCandidateInsights[
        "Policy Awareness & Political Behavior"
      ].pdfUploaded = true;
      election.aiInsights.set(candidateId, updatedCandidateInsights);
      await election.save();
    } catch (uploadError) {
      console.error("PDF processing failed:", uploadError);
      const updatedCandidateInsights = election.aiInsights.get(candidateId);
      updatedCandidateInsights[
        "Policy Awareness & Political Behavior"
      ].pdfUploaded = false;
      election.aiInsights.set(candidateId, updatedCandidateInsights);
      await election.save();
    }

    if (fs.existsSync(localPath)) {
      fs.unlink(localPath, (err) => {
        if (err) console.warn("Failed to delete local PDF:", err);
      });
    }

    res.redirect(`/api/insights/${electionId}/report`);
  } catch (err) {
    console.error("Error generating policy insight:", err);
    res.status(500).redirect(`/api/insights/${req.params.id}/report`);
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
      console.warn("No rejections found or failed to fetch:", err.message);
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
    candidateInsights["Sentiment & Expectations"] = {
      content: aiContent,
      pdfUploaded: false,
    };
    await election.save();

    const fileName = `sentiments_${electionId}_${candidateId}.pdf`;
    const localPath = path.join(__dirname, `../pdfs/${fileName}`);
    const storagePath = `allinsights/${fileName}`;

    if (!fs.existsSync(path.dirname(localPath))) {
      fs.mkdirSync(path.dirname(localPath), { recursive: true });
    }

    try {
      await generateInsightPDF({
        sectionTitle: "Sentiment & Expectations",
        content: aiContent,
        filePath: localPath,
        electionDetails: {
          type: election.type,
          electionNumber: election.electionNumber,
          startDate: election.endDate,
        },
      });

      await bucket.upload(localPath, {
        destination: storagePath,
        gzip: true,
        metadata: {
          cacheControl: "public, max-age=31536000",
        },
      });

      const updatedCandidateInsights = election.aiInsights.get(candidateId);
      updatedCandidateInsights["Sentiment & Expectations"].pdfUploaded = true;
      election.aiInsights.set(candidateId, updatedCandidateInsights);
      await election.save();
    } catch (uploadError) {
      console.error("PDF processing failed:", uploadError);
      const updatedCandidateInsights = election.aiInsights.get(candidateId);
      updatedCandidateInsights["Sentiment & Expectations"].pdfUploaded = false;
      election.aiInsights.set(candidateId, updatedCandidateInsights);
      await election.save();
    }

    if (fs.existsSync(localPath)) {
      fs.unlink(localPath, (err) => {
        if (err) console.warn("Failed to delete local PDF:", err);
      });
    }

    res.redirect(`/api/insights/${electionId}/report`);
  } catch (err) {
    console.error("Error generating sentiment insight:", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).redirect(`/api/insights/${req.params.id}/report`);
  }
};

// Add at the bottom of insightController.js

// exports.viewInsightPdf = async (req, res, next) => {
//   const filename = req.params.filename; // e.g. education_abc_xyz.pdf

//   const file = bucket.file(`allinsights/${filename}`);

//   try {
//     const [exists] = await file.exists();
//     if (!exists) {
//       return res.status(404).send("PDF not found in cloud storage.");
//     }

//     const [url] = await file.getSignedUrl({
//       version: "v4",
//       action: "read",
//       expires: Date.now() + 15 * 60 * 1000, // 15 min expiry
//     });

//     res.redirect(url);
//   } catch (err) {
//     console.error("Error generating signed URL:", err);
//     next(err);
//   }
// };

// const { Storage } = require("@google-cloud/storage");
// const path = require("path");

// // Initialize Google Cloud Storage client with credentials
// const storage = new Storage({
//   keyFilename: path.join(__dirname, "../key.json"), // Path to service account key
//   projectId: "truevote-458711", // GCP project ID
// });

// const bucket = storage.bucket("truevote-insight"); // Target bucket

// // /**
//  * Handles PDF viewing requests by generating secure, temporary access URLs
//  * @param {Object} req - Express request object
//  * @param {Object} res - Express response object
//  */
exports.viewInsightPdf = async (req, res) => {
  try {
    // Extract filename from URL params (format: demographic_<electionId><candidateId>.pdf)
    const filename = req.params.filename;
    const file = bucket.file(`allinsights/${filename}`); // Construct full file path

    // Verify file existence in bucket
    const [exists] = await file.exists();
    if (!exists) {
      return res.status(404).send("PDF not found in cloud storage.");
    }

    // Create time-limited access URL (15 minutes)
    const [url] = await file.getSignedUrl({
      version: "v4", // Latest signing method
      action: "read", // Read-only permission
      expires: Date.now() + 15 * 60 * 1000, // 15 minute expiry
    });

    // Redirect user to the temporary URL
    return res.redirect(url);
  } catch (err) {
    console.error("Error generating signed URL:", err);
    res.status(500).send("Failed to generate access to the PDF.");
  }
};
