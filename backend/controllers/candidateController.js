const passport = require("passport");
const Candidate = require("../models/Candidate");
const User = require("../models/User");

// GET: Show candidate registration form
exports.showRegisterCandidateForm = (req, res) => {
  res.render("register-candidate");
};

// POST: Handle candidate registration
exports.registerCandidate = async (req, res, next) => {
  try {
    const { name, email, password, bio, party, profileImage, partySymbol } =
      req.body;

    // Basic validation
    if (!name || !email || !password || !bio) {
      return res.status(400).render("register-candidate", {
        errorMessage: "All required fields must be filled",
      });
    }

    // Step 1: Create Candidate
    const newCandidate = new Candidate({
      name,
      email,
      bio,
      party: party || "Independent",
      profileImage,
      partySymbol,
    });

    await newCandidate.save();

    // Step 2: Register User (passport-local-mongoose handles hashing)
    User.register(
      new User({
        email,
        role: "candidate",
        candidate: newCandidate._id,
      }),
      password,
      async (err, user) => {
        if (err) {
          // Clean up if user creation fails
          await Candidate.findByIdAndDelete(newCandidate._id);

          const errorMessage =
            err.name === "UserExistsError"
              ? "Email already registered"
              : "Registration failed";

          return res.status(400).render("register-candidate", {
            errorMessage,
          });
        }

        // Step 3: Link Candidate to User
        newCandidate.user = user._id;
        await newCandidate.save();

        // Step 4: Auto-login
        req.login(user, (err) => {
          if (err) return next(err);
          user.hadLoggedIn = true;
          user.save();
          return res.redirect("/candidates/dashboard");
        });
      }
    );
  } catch (error) {
    console.error("Registration Error:", error);
    return res.status(500).render("register-candidate", {
      errorMessage: "An error occurred during registration. Please try again.",
    });
  }
};

exports.showEditCandidateForm = async (req, res) => {
  try {
    const candidateId = req.user.candidate;
    const candidate = await Candidate.findById(candidateId);
    if (!candidate) return res.status(404).send("Candidate not found");

    res.render("edit-candidate", { candidate });
  } catch (err) {
    console.error("Error loading edit form:", err);
    res.status(500).send("Server error");
  }
};

exports.updateCandidate = async (req, res) => {
  try {
    const candidateId = req.user.candidate;
    const { name, bio, party, profileImage, partySymbol } = req.body;

    const candidate = await Candidate.findById(candidateId);
    if (!candidate) return res.status(404).send("Candidate not found");

    // Update fields (fallback to existing values if empty)
    candidate.name = name || candidate.name;
    candidate.bio = bio || candidate.bio;
    candidate.party = party || candidate.party;
    candidate.profileImage = profileImage || candidate.profileImage;
    candidate.partySymbol = partySymbol || candidate.partySymbol;

    await candidate.save();
    res.redirect("/candidates/dashboard");
  } catch (err) {
    console.error("Error updating candidate:", err);
    res.status(500).send("Server error");
  }
};
