const passport = require("passport");
const User = require("../models/User"); // Add this line at the top
const Candidate = require("../models/Candidate"); // Also add Candidate if needed

// Show login form
exports.showLoginForm = (req, res) => {
  res.render("login"); // ✅ Renders views/login.ejs
};

// // Handle login with role-based redirect
// exports.loginUser = (req, res, next) => {
//   passport.authenticate("local", (err, user, info) => {
//     if (err) return next(err);
//     if (!user) return res.redirect("/api/users/login");

//     req.logIn(user, (err) => {
//       if (err) return next(err);

//       // Role-based redirect
//       if (user.role === "system_admin") {
//         return res.redirect("/admin-dashboard");
//       } else if (user.role === "candidate") {
//         return res.redirect("/candidate-dashboard");
//       }

//       return res.status(403).send("Access denied: Role not recognized.");
//     });
//   })(req, res, next);
// };

// Handle login with role-based redirect
exports.loginUser = (req, res, next) => {
  passport.authenticate("local", async (err, user, info) => {
    if (err) return next(err);
    if (!user) return res.redirect("/api/users/login");

    req.logIn(user, async (err) => {
      if (err) return next(err);

      try {
        // Role-based redirect with data population
        if (user.role === "system_admin") {
          return res.redirect("/admin-dashboard");
        } else if (user.role === "candidate") {
          // Populate candidate data if available
          if (user.candidate) {
            const Candidate = require("../models/Candidate");
            const populatedUser = await User.findById(user._id).populate(
              "candidate"
            );
            return res.render("candidate-dashboard", {
              user: populatedUser,
              candidate: populatedUser.candidate,
            });
          }
          return res.render("candidate-dashboard", { user });
        }

        return res.status(403).send("Access denied: Role not recognized.");
      } catch (error) {
        return next(error);
      }
    });
  })(req, res, next);
};

// Logout user
exports.logoutUser = (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    res.redirect("/api/users/login"); // ✅ or change to /login if your login form is at that route
  });
};
