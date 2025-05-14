const passport = require("passport");
const User = require("../models/User"); // Add this line at the top
const Candidate = require("../models/Candidate"); // Also add Candidate if needed

const crypto = require("crypto");
const sendEmail = require("../utils/sendEmail"); // You’ll create this next
const nodemailer = require("nodemailer");

// Show login form
exports.showLoginForm = (req, res) => {
  res.render("login"); // ✅ Renders views/login.ejs
};

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

// Show change password form
exports.showChangePasswordForm = (req, res) => {
  res.render("change-password", {
    title: "Change Password",
    error: req.query.error,
    success: req.query.success,
  });
};

// Handle password change
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    // Validate input
    if (newPassword !== confirmPassword) {
      return res.redirect(
        "/api/users/change-password?error=New+passwords+do+not+match"
      );
    }

    // Find the user
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.redirect("/api/users/change-password?error=User+not+found");
    }

    // Authenticate current password
    const authenticatedUser = await new Promise((resolve, reject) => {
      user.authenticate(currentPassword, (err, thisModel, passwordError) => {
        if (err || passwordError || !thisModel) {
          return resolve(null);
        }
        resolve(thisModel);
      });
    });

    if (!authenticatedUser) {
      return res.redirect(
        "/api/users/change-password?error=Current+password+is+incorrect"
      );
    }

    // Set new password
    await new Promise((resolve, reject) => {
      user.setPassword(newPassword, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    await user.save();

    res.redirect(
      "/api/users/change-password?success=Password+changed+successfully"
    );
  } catch (err) {
    console.error("Password change error:", err);
    res.redirect("/api/users/change-password?error=Error+changing+password");
  }
};

// Reset password logic

// --- Show Forgot Password Form
exports.showForgotForm = (req, res) => {
  res.render("forgot-password", {
    title: "Forgot Password",
    error: req.query.error,
    success: req.query.success,
  });
};

// --- Request Password Reset (send reset link)
exports.requestResetPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.redirect("/users/forgot-password?error=User+not+found");
    }

    const token = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    // ✅ FIX: use correct route prefix to match Express
    const resetLink = `http://${req.headers.host}/users/reset-password/${token}`;

    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      to: user.email,
      from: process.env.EMAIL_USER,
      subject: "Reset Your Password",
      text: `You requested a password reset.\n\nClick the link to reset your password:\n\n${resetLink}\n\nIf you did not request this, you can safely ignore this email.`,
    });

    return res.redirect(
      "/users/forgot-password?success=Reset+link+sent+to+your+email"
    );
  } catch (err) {
    console.error("Error sending reset email:", err);
    return res.redirect(
      "/users/forgot-password?error=Error+processing+request"
    );
  }
};

// --- Show Reset Password Form (GET via token)
exports.showResetForm = async (req, res) => {
  const { token } = req.params;

  const user = await User.findOne({
    resetPasswordToken: token,
    resetPasswordExpires: { $gt: Date.now() },
  });

  if (!user) {
    return res.redirect(
      "/users/forgot-password?error=Invalid+or+expired+reset+token"
    );
  }

  // res.render("reset-password", {
  //   token,
  //   error: req.query.error,
  //   success: req.query.success,
  // });

  res.render("reset-password", {
    token,
    error: req.query.error,
    success: req.query.success,
    email: user.email, // ✅ add this
  });
};

// --- Handle New Password Submission (POST)
exports.resetPassword = async (req, res) => {
  const { token } = req.params;
  const { newPassword, confirmPassword } = req.body;

  if (newPassword !== confirmPassword) {
    return res.redirect(
      `/users/reset-password/${token}?error=Passwords+do+not+match`
    );
  }

  try {
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.redirect(
        "/users/forgot-password?error=Invalid+or+expired+reset+token"
      );
    }

    await new Promise((resolve, reject) => {
      user.setPassword(newPassword, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    // res.redirect("/login?success=Password+reset+successfully");
    res.redirect("/api/users/login?success=Password+reset+successfully");
  } catch (err) {
    console.error("Reset error:", err);
    res.redirect(
      `/users/reset-password/${token}?error=An+unexpected+error+occurred`
    );
  }
};
