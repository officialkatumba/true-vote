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

    const prompt = `
You are a professional election analyst with access to both internal voter data and external public sources. Your goal is to generate a deep, strategic report (preferably between 500 and 1000 words) on the **Demographic Profile** of voters and non-voters (rejections).

You should:
- Analyze the internal election data
- Interpret the candidate-submitted election context
- Include publicly known and web-searchable information about the candidate named **${
      candidate.name
    }**
- Use this to make the report insightful and strategic for campaign purposes

Election Context Notes (from candidate):
${electionContextText}

Voter Records:
${JSON.stringify(extractedVotes, null, 2)}

Rejection Records:
${JSON.stringify(extractedRejections, null, 2)}

Please identify patterns across age, gender, and marital status, and include public insights if available.
Write clearly, objectively, and helpfully. The more detailed the better.
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const aiContent = completion.choices[0].message.content.trim();

    // 5. Store insights in election document (existing logic unchanged)
    if (!election.aiInsights.has(candidateId)) {
      election.aiInsights.set(candidateId, {});
    }

    const candidateInsights = election.aiInsights.get(candidateId);
    candidateInsights["Demographic Profile"] = {
      content: aiContent,
      pdfUploaded: false,
    };
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

// Genrate eduction insight

exports.generateEducationalInsight = async (req, res) => {
  try {
    const { id: electionId } = req.params;
    const candidateId = req.user.candidate._id.toString();

    // 1. Fetch and validate election
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

    // 3. Prepare educational data
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

    // 4. Generate AI analysis
    // const candidate = await Candidate.findById(candidateId); // Ensure valid candidate fetch
    const electionContextText = election.electionContext || "";

    const prompt = `
You are a professional election strategist with a specialization in educational and sociopolitical analysis. You have access to internal voter and rejection data, as well as campaign-submitted context for the candidate **${
      candidate.name
    }**.

Your task is to write a rich, strategic analysis (target 500–1000 words) on the **Educational Journey** of the electorate in this election. Your analysis should synthesize both internal and external perspectives to provide high-value insights.

Use the internal data provided below to identify key patterns, including:

- The highest level of education attained among voters and non-voters
- Geographic trends in where individuals completed their schooling (e.g., province or region of study)
- Differences in educational pathways between voters and rejections
- Notable links between educational background and likely voter behavior
- Any patterns by constituency or demographic clusters

Incorporate this campaign context provided by the candidate:
"${electionContextText}"

❗ Additionally, **enrich your analysis with publicly available or contextual insights** where relevant. This may include:
- Regional disparities in educational access or literacy rates
- Trends in migration for education (e.g., rural students moving to urban areas)
- Known educational infrastructure issues in certain districts
- General socio-political attitudes among different education levels in the region

These external elements should complement the internal data to give a full-picture understanding of how education might influence political engagement, preferences, and strategic outreach.

Voter Records:
${JSON.stringify(extractedVotes, null, 2)}

Rejection Records:
${JSON.stringify(extractedRejections, null, 2)}

Write in a clear, objective, and analytical tone. Prioritize synthesis and actionable takeaways. Include concrete strategic recommendations that the candidate can use to tailor messaging, outreach, or policy focus.
`;

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
    candidateInsights["Educational Journey"] = {
      content: aiContent,
      pdfUploaded: false,
    };
    election.aiInsights.set(candidateId, candidateInsights);
    await election.save();

    // 6. Generate and upload PDF
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

      const updatedCandidateInsights = election.aiInsights.get(candidateId);
      updatedCandidateInsights["Educational Journey"].pdfUploaded = true;
      election.aiInsights.set(candidateId, updatedCandidateInsights);
      await election.save();

      console.log(`PDF successfully uploaded to ${storagePath}`);
    } catch (uploadError) {
      console.error("PDF processing failed:", {
        error: uploadError.message,
        stack: uploadError.stack,
      });

      const updatedCandidateInsights = election.aiInsights.get(candidateId);
      updatedCandidateInsights["Educational Journey"].pdfUploaded = false;
      election.aiInsights.set(candidateId, updatedCandidateInsights);
      await election.save();
    }

    // 7. Clean up local file
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

    const candidate = await Candidate.findById(candidateId);
    const electionContextText = election.electionContext || "";

    // const candidate = await Candidate.findById(candidateId);
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

    const prompt = `
You are a professional election analyst with access to internal voter data, rejection data, and candidate-submitted campaign context.

Your task is to write a comprehensive, strategic analysis (target 500–1000 words) about the **Living Context** of voters and non-voters for the candidate **${
      candidate.name
    }**.

Use the internal data provided below to identify and interpret patterns related to:

- Dwelling types (urban vs rural patterns)
- Family dwelling structures and their implications
- District and constituency-level breakdowns
- Differences between voters and non-voters (rejections)
- How these living conditions may influence political behavior and election outcomes

Also, incorporate this campaign-specific context submitted by the candidate:
"${electionContextText}"

❗ Additionally, where appropriate, **augment your analysis with relevant publicly available or external knowledge** about the region, such as:
- Urbanization rates or housing development challenges
- Regional differences in living standards or infrastructure
- Known socio-economic issues affecting specific districts or constituencies
- Migration patterns, overcrowding, or rural-urban divides

These external insights should help you contextualize internal patterns more deeply and provide richer strategic recommendations.

Voter Records:
${JSON.stringify(extractedVotes, null, 2)}

Rejection Records:
${JSON.stringify(extractedRejections, null, 2)}

Write in a professional tone. Focus on uncovering strategic findings, synthesizing key themes, and giving the candidate **actionable advice** based on both data and context. Avoid repetition and summarize trends clearly.
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 1500,
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

    const candidate = await Candidate.findById(candidateId);

    // const candidate = await Candidate.findById(candidateId);
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

    const economicFields = [
      "incomeLevel",
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

    const electionContextText = election.electionContext?.[candidateId] || "";

    const prompt = `
You are a senior political economist analyzing voter behavior in the context of economic indicators. You have access to internal election data, including votes and rejections for the candidate **${
      candidate.name
    }**.

Your task is to write a thorough, strategic analysis (target: 500–1000 words) of the **Economic Factors** influencing voter behavior in this election. Focus on patterns and contrasts related to:

- Average monthly rent
- Employment status
- Sector of operation (e.g., marketeer, small business, farming, formal employment, etc.)

Analyze key differences between voters and non-voters (rejections), and explore how economic precarity, employment trends, or sector-specific challenges may be influencing political preferences or rejection behavior.

Incorporate strategic insights that the candidate can act on for better campaign targeting and messaging.

Also, include commentary based on the following campaign context submitted by the candidate:
"${electionContextText}"

Furthermore, enrich your analysis with publicly available or contextual insights relevant to the region. This may include:

- Current inflation rates and their impact on the cost of living
- Employment trends and unemployment rates
- Economic growth projections and sectoral performance
- Regional disparities in economic development
- Any recent economic reforms or policy changes

Voter Records:
${JSON.stringify(extractedVotes, null, 2)}

Rejection Records:
${JSON.stringify(extractedRejections, null, 2)}

Write in a professional, analytical tone. Your output should synthesize trends, highlight strategic takeaways, and provide clear recommendations to the candidate for policy positioning or voter outreach.
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 1500,
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

    // const candidate = req.user.candidate;
    const electionContextText =
      election.context ?? "No campaign context provided.";

    const prompt = `
You are a political analyst and messaging strategist helping a candidate understand their voter base.

Your task is to write a 500–1000 word strategic insight report on **Policy Awareness & Political Behavior** for candidate **${
      candidate.name
    }** in the current election.

Use both internal data and relevant external context. The data includes:

- How familiar voters are with the candidate's policies
- Their level of understanding of those policies
- Their usual party support behavior

Also include patterns among rejection data (non-supporters) and incorporate political context from the candidate’s notes and publicly available political discourse.

Provide actionable recommendations on:

- Clarifying or improving messaging of key policies
- Aligning or contrasting with broader public concerns
- Outreach tactics based on gaps in awareness or understanding

Election Context (candidate-submitted notes):
${electionContextText}

Voter Records:
${JSON.stringify(extractedVotes, null, 2)}

Rejection Records:
${JSON.stringify(extractedRejections, null, 2)}

Keep the tone professional, analytical, and campaign-ready.
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 2000,
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
    election.aiInsights.set(candidateId, candidateInsights);
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

      const [bucketExists] = await bucket.exists();
      if (!bucketExists) throw new Error("Bucket does not exist or no access");

      await bucket.upload(localPath, {
        destination: storagePath,
        gzip: true,
        metadata: { cacheControl: "public, max-age=31536000" },
      });

      const updatedInsights = election.aiInsights.get(candidateId);
      updatedInsights[
        "Policy Awareness & Political Behavior"
      ].pdfUploaded = true;
      election.aiInsights.set(candidateId, updatedInsights);
      await election.save();

      console.log(`PDF uploaded: ${storagePath}`);
    } catch (uploadError) {
      console.error("PDF upload failed:", uploadError.message);
      const updatedInsights = election.aiInsights.get(candidateId);
      updatedInsights[
        "Policy Awareness & Political Behavior"
      ].pdfUploaded = false;
      election.aiInsights.set(candidateId, updatedInsights);
      await election.save();
    }

    if (fs.existsSync(localPath)) {
      fs.unlink(localPath, (err) => {
        if (err) console.warn("Failed to delete local PDF:", err);
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

    const sentimentFields = [
      "relativeVoteLikelihood",
      "expectationsFromCandidate",
      "reasonForVoting",
      "reasonForRelativeVote",
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

    // const candidate = await Candidate.findById(candidateId); // ✅ Safely fetch candidate
    const electionContextText = election.electionContext || "";

    // const candidate = req.user.candidate;
    // const electionContextText =
    //   election.context ?? "No campaign context provided.";

    const prompt = `
You are a political psychologist and messaging strategist with deep experience in campaign voter sentiment analysis.

Your task is to write a 500–1000 word strategic insight on **Voter Sentiment & Expectations** for candidate **${
      candidate.name
    }** in the current election.

Use both internal data and relevant contextual thinking. The data includes:

- Voter feedback on what they dislike about the candidate
- What they expect from the candidate
- Their stated reasons for voting

Also include patterns among rejection data (non-supporters), and relate findings to possible communication gaps, unmet expectations, or value misalignment.

Provide actionable recommendations for:

- Messaging improvements
- Potential tone and language adjustments
- Targeted outreach ideas based on concerns and hopes

Election Context (candidate-submitted notes):
${electionContextText}

Voter Records:
${JSON.stringify(extractedVotes, null, 2)}

Rejection Records:
${JSON.stringify(extractedRejections, null, 2)}

Write clearly, strategically, and focus on real-world campaign action.
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 2000,
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
    election.aiInsights.set(candidateId, candidateInsights);
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
      updatedInsights["Sentiment & Expectations"].pdfUploaded = true;
      election.aiInsights.set(candidateId, updatedInsights);
      await election.save();

      console.log(`PDF uploaded: ${storagePath}`);
    } catch (uploadError) {
      console.error("PDF upload failed:", uploadError.message);
      const updatedInsights = election.aiInsights.get(candidateId);
      updatedInsights["Sentiment & Expectations"].pdfUploaded = false;
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

Based on this, estimate the candidate's probability of victory (as a percentage), and provide strategic recommendations to improve the chances of winning.
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
