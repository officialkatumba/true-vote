// const express = require("express");
// const router = express.Router();
// // const ensureAuthenticated = require("../middleware/auth");

// // module.exports = function ensureAuthenticated(req, res, next) {
// //     if (req.isAuthenticated()) return next();
// //     res.redirect("/api/users/login");
// //   };

// router.get("/candidate-dashboard", (req, res) => {
//   res.render("candidate-dashboard", { user: req.user });
// });

// router.get("/admin-dashboard", (req, res) => {
//   res.render("admin-dashboard", { user: req.user });
// });

// module.exports = router;

// routes/dashboard.js
// const express = require("express");
// const router = express.Router();

// // If not using external middleware, define inline
// function ensureAuthenticated(req, res, next) {
//   if (req.isAuthenticated()) return next();
//   res.redirect("/api/users/login");
// }

// // Candidate Dashboard Route
// router.get("/candidate-dashboard", (req, res) => {
//   res.render("candidate-dashboard", {
//     user: req.user,
//     success: req.flash("success"),
//     error: req.flash("error"),
//   });
// });

// // Admin Dashboard Route
// router.get("/admin-dashboard", (req, res) => {
//   res.render("admin-dashboard", {
//     user: req.user,
//     success: req.flash("success"),
//     error: req.flash("error"),
//   });
// });

// module.exports = router;

// routes/dashboard.js
const express = require("express");
const router = express.Router();
const User = require("../models/User"); // adjust path if needed
const ensureAuthenticated = require("../middlewares/auth"); // your auth middleware

// Admin dashboard
// router.get("/admin-dashboard", ensureAuthenticated, (req, res) => {
//   res.render("admin-dashboard", {
//     user: req.user,
//     success: req.flash("success"),
//     error: req.flash("error"),
//   });
// });

const SystemAdminProfile = require("../models/SystemAdminProfile");

router.get("/admin-dashboard", ensureAuthenticated, async (req, res) => {
  try {
    const adminProfile = await SystemAdminProfile.findOne({
      user: req.user._id,
    });

    if (!adminProfile) {
      req.flash("error", "Admin profile not found.");
      return res.redirect("/login");
    }

    res.render("admin-dashboard", {
      user: req.user,
      adminProfile,
      success: req.flash("success"),
      error: req.flash("error"),
    });
  } catch (error) {
    console.error("Error loading admin profile:", error);
    req.flash("error", "Failed to load dashboard.");
    res.redirect("/login");
  }
});

// Candidate dashboard
// router.get("/candidate-dashboard", ensureAuthenticated, async (req, res) => {
//   const user = await User.findById(req.user._id).populate("candidate");

//   res.render("candidate-dashboard", {
//     user,
//     success: req.flash("success"),
//     error: req.flash("error"),
//   });
// });

// router.get("/candidate-dashboard", ensureAuthenticated, async (req, res) => {
//   const user = await User.findById(req.user._id).populate("candidate");

//   res.render("candidate-dashboard", {
//     user,
//     success: req.flash("success"),
//     error: req.flash("error"),
//   });
// });

router.get("/candidate-dashboard", ensureAuthenticated, async (req, res) => {
  const user = await User.findById(req.user._id).populate("candidate");

  if (!user || !user.candidate) {
    req.flash("error", "Candidate profile not found.");
    return res.redirect("/api/users/login");
  }

  res.render("candidate-dashboard", {
    user,
    success: req.flash("success"),
    error: req.flash("error"),
  });
});

module.exports = router;
