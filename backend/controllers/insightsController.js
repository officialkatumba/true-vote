require("dotenv").config();

const Vote = require("../models/Vote");
const Rejection = require("../models/Rejection");
const Election = require("../models/Election");

// Fixed import (Option 1):
const { generateInsightPDF } = require("../utils/pdfGenerator");
// const { bucket } = require("../utils/uploadToGCS.js");
const uploadPDFToGCS = require("../utils/uploadToGCS.js");

const Candidate = require("../models/Candidate"); // if not already
// const candidate = req.user.candidate; // or fetch from DB if needed
// const electionContextText = election.electionContext || "";

const fs = require("fs");
const path = require("path");

const { Storage } = require("@google-cloud/storage");

// Initialize Google Cloud Storage with explicit credentials

console.log(process.env.GOOGLE_TYPE);

const storage = new Storage({
  credentials: {
    type: process.env.GOOGLE_TYPE,
    project_id: process.env.GOOGLE_PROJECT_ID,
    private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    client_id: process.env.GOOGLE_CLIENT_ID,
    auth_uri: process.env.GOOGLE_AUTH_URI,
    token_uri: process.env.GOOGLE_TOKEN_URI,
    auth_provider_x509_cert_url: process.env.GOOGLE_AUTH_PROVIDER_CERT_URL,
    client_x509_cert_url: process.env.GOOGLE_CLIENT_CERT_URL,
  },
});

const bucket = storage.bucket(process.env.GCLOUD_STORAGE_BUCKET);

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

    // Fetch current candidate info
    const candidate = await Candidate.findById(candidateId);
    if (!candidate) return res.status(404).send("Candidate not found");

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
        aiInsights: election.aiInsights, // Still using full map
      },
      stats,
      candidate, // pass candidate object to EJS
      currentCandidateId: candidateId.toString(),
    });
  } catch (error) {
    console.error("Error generating report:", error);
    res.status(500).send("Failed to generate report.");
  }
};

//////////////////////////////////////////////

// Batching function

function createBatches(dataArray, batchSize = 50) {
  const batches = [];
  for (let i = 0; i < dataArray.length; i += batchSize) {
    batches.push(dataArray.slice(i, i + batchSize));
  }
  return batches;
}

exports.generateDemographicInsight = async (req, res) => {
  try {
    const { id: electionId } = req.params;
    const candidateId = req.user.candidate._id.toString();

    // 1. Fetch and validate election
    const election = await Election.findById(electionId);
    if (!election) {
      req.flash("error", "Election not found");
      return res.redirect("/candidate-dashboard");
    }

    const isCandidate = election.candidates.some((c) => c.equals(candidateId));
    if (!isCandidate) {
      req.flash("error", "Access denied");
      return res.redirect("/candidate-dashboard");
    }

    // 2. Fetch votes and rejections (existing logic unchanged)
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

    // 3. Prepare demographic data (existing logic unchanged)
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

    // 4. Generate AI analysis (existing logic unchanged)
    const candidate = await Candidate.findById(candidateId);
    const electionContextText = election.electionContext || "";

    const voteBatches = createBatches(extractedVotes, 50);
    const rejectionBatches = createBatches(extractedRejections, 50);

    let combinedInsights = "";

    // Step 1: Generate per-batch insights
    for (let i = 0; i < voteBatches.length; i++) {
      const voteChunk = voteBatches[i];
      const rejectionChunk = rejectionBatches[i] || [];

      const prompt = `
You are a professional election analyst. Your goal is to write a rich, strategic report (aim for 300–400 words) on the **Demographic Profile** of voters and non-voters (batch ${
        i + 1
      }).

Focus on:
- Age
- Gender
- Marital status

Incorporate the candidate-submitted election context and identify any useful patterns.

Election Context:
${electionContextText}

Voter Records:
${JSON.stringify(voteChunk, null, 2)}

Rejection Records:
${JSON.stringify(rejectionChunk, null, 2)}
`;

      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo-16k",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 1000,
      });

      combinedInsights += `\n\n${completion.choices[0].message.content.trim()}`;
    }

    const cleanedCombinedInsights = combinedInsights
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    // Step 2: Summarize the entire insight into a final unified version
    const summaryPrompt = `
You are a senior political strategist. Below are multiple demographic insight batches generated from segmented voter data for candidate **${candidate.name}**.

Your task is to synthesize them into **one cohesive, 4-page strategic report**. Eliminate redundancy, resolve contradictions, and unify the voice and tone. Structure the final result as a polished insight suitable for a professional campaign briefing.

And do not mention any batches as we want  a clear and unified document.

Clearly identify the demographic groups most likely to support or oppose the candidate, and suggest actionable strategies the candidate can use to increase their chances of winning the 2026 elections in ${election.willRunIn}.

Election Context:
${electionContextText}

Insight Batches:
${cleanedCombinedInsights}
`;

    const finalCompletion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo-16k",
      messages: [{ role: "user", content: summaryPrompt }],
      temperature: 0.7,
      max_tokens: 3000,
    });

    const aiContent = finalCompletion.choices[0].message.content.trim();

    if (!election.aiInsights.has(candidateId)) {
      election.aiInsights.set(candidateId, {});
    }

    const candidateInsights = election.aiInsights.get(candidateId);
    candidateInsights["Demographic Profile"] = {
      content: aiContent,
      pdfUploaded: false,
    };

    election.aiInsights.set(candidateId, candidateInsights); // ✅ Important step
    await election.save();

    // 6. Generate and upload PDF (existing logic unchanged)
    const fileName = `demographic_${electionId}_${candidateId}.pdf`;
    const localPath = path.join(__dirname, `../pdfs/${fileName}`);
    const storagePath = `allinsights/${fileName}`;

    if (!fs.existsSync(path.dirname(localPath))) {
      fs.mkdirSync(path.dirname(localPath), { recursive: true });
    }

    try {
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

    req.flash("success", "Demographic insights generated successfully!");
    // return res.redirect("/candidate-dashboard");
    res.redirect(`/api/insights/${electionId}/report`);
  } catch (err) {
    console.error("Error in generateDemographicInsight:", {
      message: err.message,
      stack: err.stack,
    });
    req.flash("error", "Failed to generate demographic insights");
    // return res.redirect("/candidate-dashboard");
    res.status(500).redirect(`/api/insights/${req.params.id}/report`);
  }
};

// // Genrate eduction insight

exports.generateEducationalInsight = async (req, res) => {
  try {
    const { id: electionId } = req.params;
    const candidateId = req.user.candidate._id.toString();

    // 1. Validate election and candidate
    const election = await Election.findById(electionId);
    if (!election) return res.status(404).send("Election not found");

    const isCandidate = election.candidates.some((c) => c.equals(candidateId));
    if (!isCandidate) return res.status(403).send("Access denied");

    const candidate = await Candidate.findById(candidateId);
    if (!candidate || candidate.membershipStatus !== "active") {
      return res
        .status(403)
        .send("Pay to Get this Insight: Your membership is not active.");
    }

    const electionContextText = election.electionContext || "";

    // 2. Fetch votes and rejections
    const votes = await Vote.find({
      election: electionId,
      candidate: candidateId,
    });
    const rejections = await Rejection.find({ election: electionId });

    // 3. Extract only relevant education-related fields
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

    // 4. Batching: Generate per-batch analysis
    const voteBatches = createBatches(extractedVotes, 50);
    const rejectionBatches = createBatches(extractedRejections, 50);

    let combinedInsights = "";

    for (let i = 0; i < voteBatches.length; i++) {
      const voteChunk = voteBatches[i];
      const rejectionChunk = rejectionBatches[i] || [];

      const prompt = `
You are a professional election strategist. Analyze the **Educational Journey** of voters and non-voters (batch ${
        i + 1
      }) for candidate ${candidate.name}.

Focus on:
- Highest education level
- Where people studied (province)
- Differences between voters and rejections
- Any behavior patterns from educational background

Election Context:
${electionContextText}

Voter Records:
${JSON.stringify(voteChunk, null, 2)}

Rejection Records:
${JSON.stringify(rejectionChunk, null, 2)}
`;

      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo-16k",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 1000,
      });

      combinedInsights += `\n\n${completion.choices[0].message.content.trim()}`;
    }

    const cleanedCombinedInsights = combinedInsights
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    // 5. Final synthesis prompt
    const summaryPrompt = `
You are a senior political analyst. Below are batch-wise educational insights for candidate ${candidate.name}.

Your job: Summarize into ONE cohesive, professional report (~4 pages). Eliminate repetition, unify tone, highlight patterns, and recommend strategic actions.

And do not mention any batches as we want  a clear and unified document.

Based on voter data from the election in ${election.willRunIn}, clearly identify the education backgrounds most likely to support or oppose the candidate. Explain what the candidate can do to improve their chances of winning the 2026 elections, taking into account local education-related trends and concerns.

Election Context:
${electionContextText}

Insight Batches:
${cleanedCombinedInsights}
`;

    const finalCompletion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo-16k",
      messages: [{ role: "user", content: summaryPrompt }],
      temperature: 0.7,
      max_tokens: 3000,
    });

    const aiContent = finalCompletion.choices[0].message.content.trim();

    // 6. Store in DB
    if (!election.aiInsights.has(candidateId)) {
      election.aiInsights.set(candidateId, {});
    }
    const candidateInsights = election.aiInsights.get(candidateId);
    candidateInsights["Educational Journey"] = {
      content: aiContent,
      pdfUploaded: false,
    };
    election.aiInsights.set(candidateId, candidateInsights);
    await election.save();

    // 7. Generate and upload PDF
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
      if (!bucketExists) throw new Error("Bucket missing or no permissions");

      await bucket.upload(localPath, {
        destination: storagePath,
        gzip: true,
        metadata: { cacheControl: "public, max-age=31536000" },
      });

      const updatedCandidateInsights = election.aiInsights.get(candidateId);
      updatedCandidateInsights["Educational Journey"].pdfUploaded = true;
      election.aiInsights.set(candidateId, updatedCandidateInsights);
      await election.save();

      console.log(`PDF uploaded: ${storagePath}`);
    } catch (err) {
      console.error("PDF upload failed:", err.message);
      const updatedCandidateInsights = election.aiInsights.get(candidateId);
      updatedCandidateInsights["Educational Journey"].pdfUploaded = false;
      election.aiInsights.set(candidateId, updatedCandidateInsights);
      await election.save();
    }

    if (fs.existsSync(localPath)) {
      fs.unlink(localPath, (err) => {
        if (err) console.warn("PDF cleanup failed:", err);
      });
    }

    res.redirect(`/api/insights/${electionId}/report`);
  } catch (err) {
    console.error("Error in generateEducationalInsight:", err);
    res.status(500).redirect(`/api/insights/${req.params.id}/report`);
  }
};

// General living conditiona or location

exports.generateLivingInsight = async (req, res) => {
  try {
    const { id: electionId } = req.params;
    const candidateId = req.user.candidate._id.toString();

    const election = await Election.findById(electionId);
    if (!election) return res.status(404).send("Election not found");

    const isCandidate = election.candidates.some((c) => c.equals(candidateId));
    if (!isCandidate) return res.status(403).send("Access denied");

    const candidate = await Candidate.findById(candidateId);
    const electionContextText = election.electionContext || "";

    if (!candidate || candidate.membershipStatus !== "active") {
      return res
        .status(403)
        .send("Pay to Get this Insight: Your membership is not active.");
    }

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
      "religiousStatus",
      "votingEligibility2026",
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

    const voteBatches = createBatches(extractedVotes, 50);
    const rejectionBatches = createBatches(extractedRejections, 50);

    let combinedInsights = "";

    for (let i = 0; i < voteBatches.length; i++) {
      const voteChunk = voteBatches[i];
      const rejectionChunk = rejectionBatches[i] || [];

      const prompt = `
You are a professional election analyst. Your goal is to write a strategic insight (~300–400 words) about the **Living Context** of voters and non-voters.

Focus on:
- Dwelling types (urban vs rural)
- Family dwelling structure
- Religious affiliation and voting eligibility

Use this candidate-provided context:
${electionContextText}

Voter Records:
${JSON.stringify(voteChunk, null, 2)}

Rejection Records:
${JSON.stringify(rejectionChunk, null, 2)}
`;

      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo-16k",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 1000,
      });

      combinedInsights += `\n\n${completion.choices[0].message.content.trim()}`;
    }

    const cleanedCombinedInsights = combinedInsights
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    const summaryPrompt = `
You are a senior political strategist. Below are insight fragments generated in batches from internal data for candidate **${candidate.name}**.

Please summarize them into a **single unified 4-page strategic report** on the **Living Context**. Avoid repeating details, unify tone and voice, and highlight key findings with strategic clarity.

And do not mention any batches as we want  a clear and unified document.

Based on voter data from the election in ${election.willRunIn}, identify the living conditions or housing situations that most influence support or rejection of the candidate, and recommend how the candidate can address these realities to improve their chances of winning the 2026 elections

Election Context:
${electionContextText}

Batched Insight Segments:
${cleanedCombinedInsights}
`;

    const finalCompletion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo-16k",
      messages: [{ role: "user", content: summaryPrompt }],
      temperature: 0.7,
      max_tokens: 3000,
    });

    const aiContent = finalCompletion.choices[0].message.content.trim();

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

// Economic insight

exports.generateEconomicInsight = async (req, res) => {
  try {
    const { id: electionId } = req.params;
    const candidateId = req.user.candidate._id.toString();

    const election = await Election.findById(electionId);
    if (!election) return res.status(404).send("Election not found");

    const isCandidate = election.candidates.some((c) => c.equals(candidateId));
    if (!isCandidate) return res.status(403).send("Access denied");

    const candidate = await Candidate.findById(candidateId);
    if (!candidate || candidate.membershipStatus !== "active") {
      return res
        .status(403)
        .send("Pay to Get this Insight: Your membership is not active.");
    }

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

    const economicFields = ["incomeLevel", "sectorOfOperation"];
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

    const electionContextText = election.electionContext?.[candidateId] || "";

    // 🧠 Batching logic
    const voteBatches = createBatches(extractedVotes, 50);
    const rejectionBatches = createBatches(extractedRejections, 50);

    let combinedInsights = "";

    for (let i = 0; i < voteBatches.length; i++) {
      const voteChunk = voteBatches[i];
      const rejectionChunk = rejectionBatches[i] || [];

      const prompt = `
You are a professional political economist. Write a 300–400 word strategic analysis of **Economic Factors** affecting voter behavior (batch ${
        i + 1
      }).

Focus on:
- Income level
- Sector of operation

Use this candidate-submitted context:
${electionContextText}

Voter Records:
${JSON.stringify(voteChunk, null, 2)}

Rejection Records:
${JSON.stringify(rejectionChunk, null, 2)}
`;

      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo-16k",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 1000,
      });

      combinedInsights += `\n\n${completion.choices[0].message.content.trim()}`;
    }

    const cleanedCombinedInsights = combinedInsights
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    // 🧠 Summarize into one final report
    const summaryPrompt = `
You are a senior political strategist. Below are several AI-generated insights on **economic behavior** of voters and non-voters for candidate **${candidate.name}**.

Unify them into one powerful, 4-page strategy document.

And do not mention any batches as we want  a clear and unified document.

Considering the economic conditions in ${election.willRunIn}, analyze which economic factors drive voter support or opposition for the candidate, and suggest practical strategies the candidate can adopt to improve their chances of winning the 2026 elections


Election Context:
${electionContextText}

Insight Batches:
${cleanedCombinedInsights}
`;

    const finalCompletion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo-16k",
      messages: [{ role: "user", content: summaryPrompt }],
      temperature: 0.7,
      max_tokens: 3000,
    });

    const aiContent = finalCompletion.choices[0].message.content.trim();

    // Save to DB
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

    // 🔽 Generate & Upload PDF
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
      if (!bucketExists)
        throw new Error("Bucket does not exist or no access permissions");

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
// Policy awareness insight

exports.generatePolicyInsight = async (req, res) => {
  try {
    const { id: electionId } = req.params;
    const candidateId = req.user.candidate._id.toString();

    const election = await Election.findById(electionId);
    if (!election) return res.status(404).send("Election not found");

    const isCandidate = election.candidates.some((c) => c.equals(candidateId));
    if (!isCandidate) return res.status(403).send("Access denied");

    const candidate = await Candidate.findById(candidateId);
    if (!candidate || candidate.membershipStatus !== "active") {
      return res.status(403).send("Your membership is not active.");
    }

    const votes = await Vote.find({
      election: electionId,
      candidate: candidateId,
    });
    const rejections = await Rejection.find({ election: electionId });

    const policyFields = [
      "familiarWithPolicies",
      "policyUnderstanding",
      "reasonForVoting",
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

    const electionContextText = election.electionContext?.[candidateId] || "";

    const voteBatches = createBatches(extractedVotes, 50);
    const rejectionBatches = createBatches(extractedRejections, 50);
    let combinedInsights = "";

    for (let i = 0; i < voteBatches.length; i++) {
      const voteChunk = voteBatches[i];
      const rejectionChunk = rejectionBatches[i] || [];

      const prompt = `
You are a political strategist. Analyze voter **Policy Awareness & Political Behavior** in batch ${
        i + 1
      }.

Focus on:
- Familiarity with policies
- Clarity of understanding
- Patterns in support vs rejection
- Gaps in communication

Election Context:
${electionContextText}

Voter Records:
${JSON.stringify(voteChunk, null, 2)}

Rejection Records:
${JSON.stringify(rejectionChunk, null, 2)}
`;

      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo-16k",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 1000,
      });

      combinedInsights += `\n\n${completion.choices[0].message.content.trim()}`;
    }

    const cleanedCombinedInsights = combinedInsights
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    const summaryPrompt = `
You are a campaign advisor. Below are multiple insight chunks on **Policy Awareness & Political Behavior**.

Unify them into a professional, polished, 4-page insight report for candidate **${candidate.name}**. Eliminate redundancy, harmonize tone, and offer recommendations.

And do not mention any batches as we want  a clear and unified document.

Based on the political landscape and voter priorities in ${election.willRunIn}, analyze which policies resonate most with supporters and which cause opposition, and recommend how the candidate can refine their policy platform to boost their chances of winning the 2026 elections.

Context:
${electionContextText}

Insight Batches:
${cleanedCombinedInsights}
`;

    const finalCompletion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo-16k",
      messages: [{ role: "user", content: summaryPrompt }],
      temperature: 0.7,
      max_tokens: 3000,
    });

    const aiContent = finalCompletion.choices[0].message.content.trim();

    if (!election.aiInsights.has(candidateId)) {
      election.aiInsights.set(candidateId, {});
    }

    const candidateInsights = election.aiInsights.get(candidateId);
    candidateInsights["Policy Awareness & Political Behavior"] = {
      content: aiContent,
      pdfUploaded: false,
    };
    election.aiInsights.set(candidateId, candidateInsights);
    await election.save();

    // generate PDF and upload
    const fileName = `policy_${electionId}_${candidateId}.pdf`;
    const localPath = path.join(__dirname, `../pdfs/${fileName}`);
    const storagePath = `allinsights/${fileName}`;

    if (!fs.existsSync(path.dirname(localPath))) {
      fs.mkdirSync(path.dirname(localPath), { recursive: true });
    }

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

    candidateInsights[
      "Policy Awareness & Political Behavior"
    ].pdfUploaded = true;
    election.aiInsights.set(candidateId, candidateInsights);
    await election.save();

    if (fs.existsSync(localPath)) {
      fs.unlink(localPath, (err) => {
        if (err) console.warn("Failed to delete PDF:", err);
      });
    }

    res.redirect(`/api/insights/${electionId}/report`);
  } catch (err) {
    console.error("Error in generatePolicyInsight:", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).redirect(`/api/insights/${req.params.id}/report`);
  }
};

// Sentiments insights

exports.generateSentimentInsight = async (req, res) => {
  try {
    const { id: electionId } = req.params;
    const candidateId = req.user.candidate._id.toString();

    const election = await Election.findById(electionId);
    if (!election) return res.status(404).send("Election not found");

    const isCandidate = election.candidates.some((c) => c.equals(candidateId));
    if (!isCandidate) return res.status(403).send("Access denied");

    const candidate = await Candidate.findById(candidateId);
    if (!candidate || candidate.membershipStatus !== "active") {
      return res
        .status(403)
        .send("Membership inactive. Upgrade to access insights.");
    }

    const votes = await Vote.find({
      election: electionId,
      candidate: candidateId,
    });
    const rejections = await Rejection.find({ election: electionId });

    const sentimentFields = [
      "dislikesAboutCandidate",
      "expectationsFromCandidate",
      "reasonForVoting",
      "usualPartySupport",
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

    const electionContextText = election.electionContext?.[candidateId] || "";

    const voteBatches = createBatches(extractedVotes, 50);
    const rejectionBatches = createBatches(extractedRejections, 50);

    let combinedInsights = "";

    for (let i = 0; i < voteBatches.length; i++) {
      const voteChunk = voteBatches[i];
      const rejectionChunk = rejectionBatches[i] || [];

      const prompt = `
You are a political psychologist. Analyze **Voter Sentiment & Expectations** for candidate **${
        candidate.name
      }** in batch ${i + 1}.

Focus on:
- Dislikes about the candidate
- Expectations and hopes
- Common reasons for voting or rejecting
- Party loyalty vs candidate support

Election Context:
${electionContextText}

Voter Records:
${JSON.stringify(voteChunk, null, 2)}

Rejection Records:
${JSON.stringify(rejectionChunk, null, 2)}
`;

      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo-16k",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 1000,
      });

      combinedInsights += `\n\n${completion.choices[0].message.content.trim()}`;
    }

    const cleanedCombinedInsights = combinedInsights
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    const summaryPrompt = `
You are a senior campaign psychologist. Below are raw batch analyses on **Voter Sentiment & Expectations**.

Unify them into a single, structured, 4-page campaign insight for candidate **${candidate.name}**. Eliminate repetition, resolve contradictions, and extract strategic patterns.

Be specific with messaging advice, tone adjustments, and public engagement strategies.

And do not mention any batches as we want  a clear and unified document.

Analyze the overall voter sentiment in ${election.willRunIn}, highlighting the key feelings and opinions that influence support or opposition for the candidate, and suggest how the candidate can positively shape public perception to improve their chances in the 2026 elections.

Context:
${electionContextText}

Insight Batches:
${cleanedCombinedInsights}
`;

    const finalCompletion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo-16k",
      messages: [{ role: "user", content: summaryPrompt }],
      temperature: 0.7,
      max_tokens: 3000,
    });

    const aiContent = finalCompletion.choices[0].message.content.trim();

    if (!election.aiInsights.has(candidateId)) {
      election.aiInsights.set(candidateId, {});
    }

    const candidateInsights = election.aiInsights.get(candidateId);
    candidateInsights["Sentiment & Expectations"] = {
      content: aiContent,
      pdfUploaded: false,
    };
    election.aiInsights.set(candidateId, candidateInsights);
    await election.save();

    const fileName = `sentiments_${electionId}_${candidateId}.pdf`;
    const localPath = path.join(__dirname, `../pdfs/${fileName}`);
    const storagePath = `allinsights/${fileName}`;

    if (!fs.existsSync(path.dirname(localPath))) {
      fs.mkdirSync(path.dirname(localPath), { recursive: true });
    }

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

    candidateInsights["Sentiment & Expectations"].pdfUploaded = true;
    election.aiInsights.set(candidateId, candidateInsights);
    await election.save();

    if (fs.existsSync(localPath)) {
      fs.unlink(localPath, (err) => {
        if (err) console.warn("Failed to delete PDF:", err);
      });
    }

    res.redirect(`/api/insights/${electionId}/report`);
  } catch (err) {
    console.error("Error in generateSentimentInsight:", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).redirect(`/api/insights/${req.params.id}/report`);
  }
};

// Consolidated AI insight
// const fs = require("fs");
// const path = require("path");
// const { bucket } = require("../config/gcs");
// const generateInsightPDF = require("../utils/pdfGenerator");
// const Election = require("../models/Election");
// const Candidate = require("../models/Candidate");
// const openai = require("../config/openai"); // or wherever you initialize OpenAI

exports.generateConsolidatedInsight = async (req, res) => {
  try {
    const { id: electionId } = req.params;
    const candidateId = req.user.candidate._id.toString();

    const election = await Election.findById(electionId);
    if (!election) return res.status(404).send("Election not found");

    if (!election.aiInsights.has(candidateId)) {
      return res
        .status(400)
        .send("Please generate all individual insights first.");
    }

    const insights = election.aiInsights.get(candidateId);
    const sections = [
      "Demographic Profile",
      "Educational Journey",
      "Living Context",
      "Economic Factors",
      "Policy Awareness & Political Behavior",
      "Sentiment & Expectations",
    ];

    const combinedContent = sections
      .map((title) =>
        insights[title]?.content
          ? `### ${title}\n\n${insights[title].content}\n\n`
          : ""
      )
      .join("");

    const candidate = await Candidate.findById(candidateId);
    const prompt = `
You are an AI election strategist. Summarize the following AI insight sections into a unified strategic report for candidate **${candidate.name}**.

Give a top-level overview, strategic interpretation, and campaign recommendations, ideally in 800–1200 words.

Provide a consolidated analysis of voter demographics, education, living conditions, economic factors, policy preferences, and sentiment in ${election.willRunIn}, highlighting key drivers of support and opposition, and recommend strategic actions the candidate can take to maximize their chances of winning the 2026 elections.

--- CONTENT START ---

${combinedContent}

--- CONTENT END ---
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const aiContent = completion.choices[0].message.content.trim();

    // Save to DB
    const candidateInsights = election.aiInsights.get(candidateId);
    candidateInsights["Consolidated Insight"] = {
      content: aiContent,
      pdfUploaded: false,
    };
    election.aiInsights.set(candidateId, candidateInsights);
    await election.save();

    // PDF
    const fileName = `consolidated_${electionId}_${candidateId}.pdf`;
    const localPath = path.join(__dirname, `../pdfs/${fileName}`);
    const storagePath = `allinsights/${fileName}`;
    if (!fs.existsSync(path.dirname(localPath))) {
      fs.mkdirSync(path.dirname(localPath), { recursive: true });
    }

    try {
      await generateInsightPDF({
        sectionTitle: "Consolidated Insight",
        content: aiContent,
        filePath: localPath,
        electionDetails: {
          type: election.type,
          electionNumber: election.electionNumber,
          startDate: election.startDate,
        },
      });

      await bucket.upload(localPath, {
        destination: storagePath,
        gzip: true,
        metadata: { cacheControl: "public, max-age=31536000" },
      });

      candidateInsights["Consolidated Insight"].pdfUploaded = true;
      election.aiInsights.set(candidateId, candidateInsights);
      await election.save();
    } catch (err) {
      console.error("PDF upload failed:", err.message);
    }

    if (fs.existsSync(localPath)) {
      fs.unlink(localPath, (err) => {
        if (err) console.warn("Failed to delete PDF:", err);
      });
    }

    res.redirect(`/api/insights/${electionId}/report`);
  } catch (err) {
    console.error("Error in generateConsolidatedInsight:", err);
    res.status(500).redirect(`/api/insights/${req.params.id}/report`);
  }
};

// Probability of victory insight

// const Vote = require("../models/Vote");
// const Rejection = require("../models/Rejection");

exports.generateVictoryProbability = async (req, res) => {
  try {
    const { id: electionId } = req.params;
    const candidateId = req.user.candidate._id.toString();

    const election = await Election.findById(electionId);
    if (!election) return res.status(404).send("Election not found");

    const stats = {
      myVotes: await Vote.countDocuments({
        election: electionId,
        candidate: candidateId,
      }),
      totalVotes: await Vote.countDocuments({ election: electionId }),
      totalRejected: await Rejection.countDocuments({ election: electionId }),
    };

    const candidate = await Candidate.findById(candidateId);
    const ai = election.aiInsights.get(candidateId) || {};

    const prompt = `
You are an AI strategist analyzing a candidate's election chances.

Election Context: ${election.electionContext}
Candidate: ${candidate.name}
Votes Received: ${stats.myVotes}
Total Votes: ${stats.totalVotes}
Rejected Votes: ${stats.totalRejected}

Existing Insights: ${JSON.stringify(ai, null, 2)}

Based on this, estimate the candidate's probability of victory (as a percentage), and provide strategic recommendations to improve the chances of winning.Assess the probability of the candidate winning the 2026 elections in ${
      election.willRunIn
    } based on current voter demographics, past election results, and key influencing factors, and suggest critical steps to improve their chances of victory.
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 1500,
    });

    const aiContent = completion.choices[0].message.content.trim();

    // Save to DB
    ai["Probability of Victory"] = {
      content: aiContent,
      pdfUploaded: false,
    };
    election.aiInsights.set(candidateId, ai);
    await election.save();

    // PDF
    const fileName = `victory_probability_${electionId}_${candidateId}.pdf`;
    const localPath = path.join(__dirname, `../pdfs/${fileName}`);
    const storagePath = `allinsights/${fileName}`;
    if (!fs.existsSync(path.dirname(localPath))) {
      fs.mkdirSync(path.dirname(localPath), { recursive: true });
    }

    try {
      await generateInsightPDF({
        sectionTitle: "Probability of Victory",
        content: aiContent,
        filePath: localPath,
        electionDetails: {
          type: election.type,
          electionNumber: election.electionNumber,
          startDate: election.startDate,
        },
      });

      await bucket.upload(localPath, {
        destination: storagePath,
        gzip: true,
        metadata: { cacheControl: "public, max-age=31536000" },
      });

      ai["Probability of Victory"].pdfUploaded = true;
      election.aiInsights.set(candidateId, ai);
      await election.save();
    } catch (err) {
      console.error("PDF upload failed:", err.message);
    }

    if (fs.existsSync(localPath)) {
      fs.unlink(localPath, (err) => {
        if (err) console.warn("Failed to delete PDF:", err);
      });
    }

    res.redirect(`/api/insights/${electionId}/report`);
  } catch (err) {
    console.error("Error in generateVictoryProbability:", err);
    res.status(500).redirect(`/api/insights/${req.params.id}/report`);
  }
};

// Add at the bottom of insightController.js

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

exports.generateReligiousInsight = async (req, res) => {
  try {
    const { id: electionId } = req.params;
    const candidateId = req.user.candidate._id.toString();

    const election = await Election.findById(electionId);
    if (!election) return res.status(404).send("Election not found");

    const isCandidate = election.candidates.some((c) => c.equals(candidateId));
    if (!isCandidate) return res.status(403).send("Access denied");

    const candidate = await Candidate.findById(candidateId);
    if (!candidate || candidate.membershipStatus !== "active") {
      return res
        .status(403)
        .send("Pay to Get this Insight: Your membership is not active.");
    }

    const electionContextText = election.electionContext || "";

    const votes = await Vote.find({
      election: electionId,
      candidate: candidateId,
    });
    const rejections = await Rejection.find({ election: electionId });

    const extractedVotes = votes.map((vote) => ({
      religiousStatus: vote.religiousStatus || null,
    }));
    const extractedRejections = rejections.map((rej) => ({
      religiousStatus: rej.religiousStatus || null,
    }));

    const voteBatches = createBatches(extractedVotes, 50);
    const rejectionBatches = createBatches(extractedRejections, 50);

    let combinedInsights = "";

    for (let i = 0; i < voteBatches.length; i++) {
      const voteChunk = voteBatches[i];
      const rejectionChunk = rejectionBatches[i] || [];

      const prompt = `
You are a political sociologist analyzing **Religious Affiliation Insight** for voters and non-voters (batch ${
        i + 1
      }) for candidate ${candidate.name}.

Focus on:
- Which religious groups support or reject this candidate
- Behavior patterns in religious affiliations
- Strategic implications of these trends

Election Region: ${election.willRunIn}
Election Context: ${electionContextText}

Voter Records:
${JSON.stringify(voteChunk, null, 2)}

Rejection Records:
${JSON.stringify(rejectionChunk, null, 2)}
`;

      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo-16k",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 1000,
      });

      combinedInsights += `\n\n${completion.choices[0].message.content.trim()}`;
    }

    const cleanedCombinedInsights = combinedInsights
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    const summaryPrompt = `
You are a senior political strategist. Summarize the following batch-wise insights into a **unified Religious Affiliation Insight Report** for candidate ${candidate.name}.

Do NOT mention batch numbers. Focus on:
- Which religious groups align or conflict with the candidate
- Patterns and implications
- Strategic recommendations for 2026

Election Region: ${election.willRunIn}
Election Context: ${electionContextText}

Insight Batches:
${cleanedCombinedInsights}
`;

    const finalCompletion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo-16k",
      messages: [{ role: "user", content: summaryPrompt }],
      temperature: 0.7,
      max_tokens: 3000,
    });

    const aiContent = finalCompletion.choices[0].message.content.trim();

    // Save to DB
    if (!election.aiInsights.has(candidateId)) {
      election.aiInsights.set(candidateId, {});
    }
    const candidateInsights = election.aiInsights.get(candidateId);
    candidateInsights["Religious Affiliation Insight"] = {
      content: aiContent,
      pdfUploaded: false,
    };
    election.aiInsights.set(candidateId, candidateInsights);
    await election.save();

    // Generate PDF
    const fileName = `religion_${electionId}_${candidateId}.pdf`;
    const localPath = path.join(__dirname, `../pdfs/${fileName}`);
    const storagePath = `allinsights/${fileName}`;

    if (!fs.existsSync(path.dirname(localPath))) {
      fs.mkdirSync(path.dirname(localPath), { recursive: true });
    }

    try {
      await generateInsightPDF({
        sectionTitle: "Religious Affiliation Insight",
        content: aiContent,
        filePath: localPath,
        electionDetails: {
          type: election.type,
          electionNumber: election.electionNumber,
          startDate: election.endDate,
        },
      });

      const [bucketExists] = await bucket.exists();
      if (!bucketExists) throw new Error("Bucket missing or no permissions");

      await bucket.upload(localPath, {
        destination: storagePath,
        gzip: true,
        metadata: { cacheControl: "public, max-age=31536000" },
      });

      const updatedCandidateInsights = election.aiInsights.get(candidateId);
      updatedCandidateInsights[
        "Religious Affiliation Insight"
      ].pdfUploaded = true;
      election.aiInsights.set(candidateId, updatedCandidateInsights);
      await election.save();

      console.log(`PDF uploaded: ${storagePath}`);
    } catch (err) {
      console.error("PDF upload failed:", err.message);
      const updatedCandidateInsights = election.aiInsights.get(candidateId);
      updatedCandidateInsights[
        "Religious Affiliation Insight"
      ].pdfUploaded = false;
      election.aiInsights.set(candidateId, updatedCandidateInsights);
      await election.save();
    }

    if (fs.existsSync(localPath)) {
      fs.unlink(localPath, (err) => {
        if (err) console.warn("PDF cleanup failed:", err);
      });
    }

    res.redirect(`/api/insights/${electionId}/report`);
  } catch (err) {
    console.error("Error in generateReligiousInsight:", err);
    res.status(500).redirect(`/api/insights/${req.params.id}/report`);
  }
};

exports.generatePoliticalAffiliationInsight = async (req, res) => {
  try {
    const { id: electionId } = req.params;
    const candidateId = req.user.candidate._id.toString();

    const election = await Election.findById(electionId);
    if (!election) return res.status(404).send("Election not found");

    const isCandidate = election.candidates.some((c) => c.equals(candidateId));
    if (!isCandidate) return res.status(403).send("Access denied");

    const candidate = await Candidate.findById(candidateId);
    if (!candidate || candidate.membershipStatus !== "active") {
      return res
        .status(403)
        .send("Pay to Get this Insight: Your membership is not active.");
    }

    const electionContextText = election.electionContext || "";

    const votes = await Vote.find({
      election: electionId,
      candidate: candidateId,
    });
    const rejections = await Rejection.find({ election: electionId });

    const extractedVotes = votes.map((vote) => ({
      usualPartySupport: vote.usualPartySupport || "Unknown",
    }));
    const extractedRejections = rejections.map((rej) => ({
      usualPartySupport: rej.usualPartySupport || "Unknown",
    }));

    const voteBatches = createBatches(extractedVotes, 50);
    const rejectionBatches = createBatches(extractedRejections, 50);

    let combinedInsights = "";

    for (let i = 0; i < voteBatches.length; i++) {
      const voteChunk = voteBatches[i];
      const rejectionChunk = rejectionBatches[i] || [];

      const prompt = `
You are a political strategist analyzing **Political Affiliation Insight** for voters and non-voters (batch ${
        i + 1
      }) for candidate ${candidate.name}.

Focus on:
- Which parties the voters and rejectors usually support (usualPartySupport)
- Whether the candidate is pulling support away from specific parties
- Patterns of rejection based on party loyalty
- Strategic implications: which party bases are being influenced or alienated

Election Region: ${election.willRunIn}
Election Context: ${electionContextText}

Voter Records:
${JSON.stringify(voteChunk, null, 2)}

Rejection Records:
${JSON.stringify(rejectionChunk, null, 2)}
`;

      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo-16k",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 1000,
      });

      combinedInsights += `\n\n${completion.choices[0].message.content.trim()}`;
    }

    const cleanedCombinedInsights = combinedInsights
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    const summaryPrompt = `
You are a senior political strategist. Summarize the following batch-wise insights into a **unified Political Affiliation Insight Report** for candidate ${candidate.name}.

Do NOT mention batch numbers. Focus on:
- Which political parties the candidate is gaining or losing traction with
- Whether the campaign is pulling voters from traditional party lines
- Patterns and strategic takeaways
- What parties are most at risk of losing support to this candidate
- Based on these patterns, which political party or parties the candidate should consider aligning with — or distancing from — to maximize strategic positioning in future campaigns
- Suggest specific strategic actions the candidate should take now to strengthen their competitive edge ahead of the 2026 parliamentary elections

Election Region: ${election.willRunIn}
Election Context: ${electionContextText}

Insight Batches:
${cleanedCombinedInsights}
`;

    const finalCompletion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo-16k",
      messages: [{ role: "user", content: summaryPrompt }],
      temperature: 0.7,
      max_tokens: 3000,
    });

    const aiContent = finalCompletion.choices[0].message.content.trim();

    // Save to DB
    if (!election.aiInsights.has(candidateId)) {
      election.aiInsights.set(candidateId, {});
    }
    const candidateInsights = election.aiInsights.get(candidateId);
    candidateInsights["Political Affiliation Insight"] = {
      content: aiContent,
      pdfUploaded: false,
    };
    election.aiInsights.set(candidateId, candidateInsights);
    await election.save();

    // Generate PDF
    const fileName = `political_${electionId}_${candidateId}.pdf`;
    const localPath = path.join(__dirname, `../pdfs/${fileName}`);
    const storagePath = `allinsights/${fileName}`;

    if (!fs.existsSync(path.dirname(localPath))) {
      fs.mkdirSync(path.dirname(localPath), { recursive: true });
    }

    try {
      await generateInsightPDF({
        sectionTitle: "Political Affiliation Insight",
        content: aiContent,
        filePath: localPath,
        electionDetails: {
          type: election.type,
          electionNumber: election.electionNumber,
          startDate: election.endDate,
        },
      });

      const [bucketExists] = await bucket.exists();
      if (!bucketExists) throw new Error("Bucket missing or no permissions");

      await bucket.upload(localPath, {
        destination: storagePath,
        gzip: true,
        metadata: { cacheControl: "public, max-age=31536000" },
      });

      const updatedCandidateInsights = election.aiInsights.get(candidateId);
      updatedCandidateInsights[
        "Political Affiliation Insight"
      ].pdfUploaded = true;
      election.aiInsights.set(candidateId, updatedCandidateInsights);
      await election.save();

      console.log(`PDF uploaded: ${storagePath}`);
    } catch (err) {
      console.error("PDF upload failed:", err.message);
      const updatedCandidateInsights = election.aiInsights.get(candidateId);
      updatedCandidateInsights[
        "Political Affiliation Insight"
      ].pdfUploaded = false;
      election.aiInsights.set(candidateId, updatedCandidateInsights);
      await election.save();
    }

    if (fs.existsSync(localPath)) {
      fs.unlink(localPath, (err) => {
        if (err) console.warn("PDF cleanup failed:", err);
      });
    }

    res.redirect(`/api/insights/${electionId}/report`);
  } catch (err) {
    console.error("Error in generatePoliticalAffiliationInsight:", err);
    res.status(500).redirect(`/api/insights/${req.params.id}/report`);
  }
};
