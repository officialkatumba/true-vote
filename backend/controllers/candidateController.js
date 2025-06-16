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
    const {
      name,
      email,
      password,
      bio,
      party,
      registeredForElectionType,
      profileImage,
      partySymbol,
      mobile,
    } = req.body;

    // Basic validation
    if (!name || !email || !password || !bio || !mobile) {
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
      registeredForElectionType,
      profileImage,
      partySymbol,
      mobile,
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

        // Redirect to login page instead of auto-login
        req.flash(
          "success",
          "Registration successful! Please log in to continue."
        );
        return res.redirect("/api/users/login");
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
    const { name, bio, party, profileImage, partySymbol, mobile } = req.body;

    const candidate = await Candidate.findById(candidateId);
    if (!candidate) {
      req.flash("error", "Candidate not found");
      return res.redirect("/candidates/edit");
    }

    // Update fields
    candidate.name = name || candidate.name;
    candidate.bio = bio || candidate.bio;
    candidate.party = party || candidate.party;
    candidate.profileImage = profileImage || candidate.profileImage;
    candidate.partySymbol = partySymbol || candidate.partySymbol;
    candidate.mobile = mobile || candidate.mobile;

    await candidate.save();

    req.flash("success", "Profile updated successfully!");
    res.redirect("/candidate-dashboard"); // Changed to match your route
  } catch (err) {
    console.error("Error updating candidate:", err);
    req.flash("error", "Failed to update profile");
    res.redirect("/candidates/edit");
  }
};

//  View All cnadidates

// exports.getAllCandidates = async (req, res) => {
//   try {
//     const search = req.query.search || "";
//     const limit = parseInt(req.query.limit) || 10;
//     const page = parseInt(req.query.page) || 1;

//     const query = search ? { name: { $regex: search, $options: "i" } } : {};

//     const totalCandidates = await Candidate.countDocuments(query);
//     const totalPages = Math.ceil(totalCandidates / limit);

//     const candidates = await Candidate.find(query, "candidateNumber name _id")
//       .sort({ candidateNumber: 1 })
//       .skip((page - 1) * limit)
//       .limit(limit);

//     res.render("candidates/list", {
//       candidates,
//       search,
//       limit,
//       currentPage: page,
//       totalPages,
//     });
//   } catch (err) {
//     console.error("Error fetching candidates:", err);
//     res.status(500).send("Server error");
//   }
// };

exports.getAllCandidates = async (req, res) => {
  try {
    const search = req.query.search || "";
    const limit = parseInt(req.query.limit) || 10;
    const page = parseInt(req.query.page) || 1;
    const membershipStatus = req.query.membershipStatus || "";

    const query = {};

    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    if (membershipStatus) {
      query.membershipStatus = membershipStatus;
    }

    const totalCandidates = await Candidate.countDocuments(query);
    const totalPages = Math.ceil(totalCandidates / limit);

    const candidates = await Candidate.find(
      query,
      "candidateNumber name _id membershipStatus"
    )
      .sort({ candidateNumber: 1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.render("candidates/list", {
      candidates,
      search,
      limit,
      membershipStatus,
      currentPage: page,
      totalPages,
    });
  } catch (err) {
    console.error("Error fetching candidates:", err);
    res.status(500).send("Server error");
  }
};

// exports.getCandidateByAdmin = async (req, res) => {
//   try {
//     const candidateId = req.params.id;

//     // Load candidate details
//     const candidate = await Candidate.findById(candidateId);

//     if (!candidate) {
//       return res.status(404).send("Candidate not found");
//     }

//     // Find the associated user (if needed, depends on schema)
//     const user = await User.findOne({ candidate: candidateId });

//     res.render("candidates/candidateByAdmin", {
//       user: {
//         email: user?.email || "Not Available",
//         candidate,
//       },
//     });
//   } catch (error) {
//     console.error("Error loading candidate by admin:", error);
//     res.status(500).send("Server Error");
//   }
// };

// exports.getCandidateByAdmin = async (req, res) => {
//   try {
//     const candidateId = req.params.id;

//     // Load candidate details and populate the verifying admin
//     const candidate = await Candidate.findById(candidateId).populate(
//       "verifiedBy",
//       "email"
//     );

//     if (!candidate) {
//       return res.status(404).send("Candidate not found");
//     }

//     // Find the associated user account
//     const user = await User.findOne({ candidate: candidateId });

//     res.render("candidates/candidateByAdmin", {
//       user: {
//         email: user?.email || "Not Available",
//         candidate,
//       },
//     });
//   } catch (error) {
//     console.error("Error loading candidate by admin:", error);
//     res.status(500).send("Server Error");
//   }
// };

// exports.getCandidateByAdmin = async (req, res) => {
//   try {
//     const candidateId = req.params.id;

//     // Load candidate and populate who verified
//     const candidate = await Candidate.findById(candidateId).populate(
//       "verifiedBy",
//       "email"
//     );

//     if (!candidate) {
//       return res.status(404).send("Candidate not found");
//     }

//     // Associated user account (for email)
//     const user = await User.findOne({ candidate: candidateId });

//     res.render("candidates/candidateByAdmin", {
//       userEmail: user?.email || "Not Available",
//       candidate, // ✅ pass candidate directly so you can access candidate.verifiedBy
//     });
//   } catch (error) {
//     console.error("Error loading candidate by admin:", error);
//     res.status(500).send("Server Error");
//   }
// };

exports.getCandidateByAdmin = async (req, res) => {
  try {
    const candidateId = req.params.id;

    const candidate = await Candidate.findById(candidateId)
      .populate({
        path: "verifiedBy",
        select: "email role", // Only select available fields
      })
      .lean();

    if (!candidate) {
      return res.status(404).send("Candidate not found");
    }

    res.render("candidates/candidateByAdmin", {
      candidate,
      isVerified: candidate.verified && candidate.verifiedBy,
      verifier: candidate.verifiedBy, // Pass the entire verifier object
    });
  } catch (error) {
    console.error("Error loading candidate:", error);
    res.status(500).send("Server Error");
  }
};

exports.activateMembership = async (req, res) => {
  try {
    const candidate = await Candidate.findById(req.params.id);

    if (!candidate) {
      return res.status(404).render("error", {
        errorMessage: "Candidate not found",
      });
    }

    // Only admins can activate membership
    if (req.user.role !== "system_admin") {
      return res.status(403).render("error", {
        errorMessage: "You are not authorized to perform this action",
      });
    }

    // If already active, prevent reactivation
    if (candidate.membershipStatus === "active") {
      return res.status(400).render("error", {
        errorMessage: "Membership is already active",
      });
    }

    // Activate membership
    candidate.membershipStatus = "active";

    // Set expiry to December 31st of current year
    const now = new Date();
    const endOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
    candidate.membershipExpiresOn = endOfYear;

    await candidate.save();

    res.redirect(`/candidates/${candidate._id}`); // redirect back to profile
  } catch (error) {
    console.error(error);
    res.status(500).render("error", {
      errorMessage: "Failed to activate membership",
    });
  }
};

// GET /candidates/:id/edit-membership
exports.showEditMembershipForm = async (req, res) => {
  try {
    const candidate = await Candidate.findById(req.params.id);

    if (!candidate) {
      return res
        .status(404)
        .render("error", { errorMessage: "Candidate not found" });
    }

    // Only admin allowed
    if (req.user.role !== "system_admin") {
      return res
        .status(403)
        .render("error", { errorMessage: "Unauthorized access" });
    }

    res.render("candidates/editMembership", { candidate, user: req.user });
  } catch (err) {
    console.error(err);
    res.status(500).render("error", { errorMessage: "Server error" });
  }
};

// POST /candidates/:id/update-membership
exports.updateMembership = async (req, res) => {
  try {
    const candidate = await Candidate.findById(req.params.id);

    if (!candidate) {
      return res
        .status(404)
        .json({ success: false, message: "Candidate not found" });
    }

    if (req.user.role !== "system_admin") {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    candidate.membershipStatus = req.body.membershipStatus;
    candidate.membershipExpiresOn = new Date(req.body.membershipExpiresOn);

    await candidate.save();

    res.json({ success: true, message: "Membership updated successfully" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Failed to update membership" });
  }
};
