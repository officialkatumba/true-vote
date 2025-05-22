const passport = require("passport");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

const User = require("../models/User");
const Candidate = require("../models/Candidate");

// Show login form
exports.showLoginForm = (req, res) => {
  res.render("login", {
    success: req.flash("success"),
    error: req.flash("error"),
  });
};

// Handle login with role-based redirect

exports.loginUser = (req, res, next) => {
  passport.authenticate("local", async (err, user, info) => {
    if (err) return next(err);

    if (!user) {
      req.flash("error", "Invalid email or password");
      return res.redirect("/api/users/login");
    }

    req.logIn(user, async (err) => {
      if (err) return next(err);

      try {
        if (user.role === "system_admin") {
          req.flash("success", "Welcome system admin!");
          return res.redirect("/admin-dashboard");
        }

        if (user.role === "candidate") {
          const populatedUser = await User.findById(user._id).populate(
            "candidate"
          );

          if (!populatedUser || !populatedUser.candidate) {
            req.flash("error", "Candidate data not found.");
            return res.redirect("/api/users/login");
          }

          const name = populatedUser.candidate.name || populatedUser.email;
          req.flash("success", `Welcome back, ${name}!`);
          return res.redirect("/candidate-dashboard");
        }

        req.flash("error", "Access denied: Role not recognized.");
        return res.redirect("/api/users/login");
      } catch (error) {
        console.error("Login error:", error);
        req.flash("error", "Unexpected error occurred during login.");
        return res.redirect("/api/users/login");
      }
    });
  })(req, res, next);
};

// Logout user
exports.logoutUser = (req, res) => {
  req.logout(() => {
    req.flash("success", "You have been logged out.");
    res.redirect("/api/users/login");
  });
};

// Show change password form

exports.showChangePasswordForm = (req, res) => {
  res.render("change-password", {
    title: "Change Password",
    success: req.flash("success"),
    error: req.flash("error"),
  });
};

// Handle password change
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (newPassword !== confirmPassword) {
      req.flash("error", "New passwords do not match");
      return res.redirect("/api/users/change-password");
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      req.flash("error", "User not found");
      return res.redirect("/api/users/change-password");
    }

    const authenticatedUser = await new Promise((resolve) => {
      user.authenticate(currentPassword, (err, thisModel, passwordError) => {
        if (err || passwordError || !thisModel) return resolve(null);
        resolve(thisModel);
      });
    });

    if (!authenticatedUser) {
      req.flash("error", "Current password is incorrect");
      return res.redirect("/api/users/change-password");
    }

    await new Promise((resolve, reject) => {
      user.setPassword(newPassword, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    await user.save();
    req.flash("success", "Password changed successfully");
    res.redirect("/api/users/change-password");
  } catch (err) {
    console.error("Password change error:", err);
    req.flash("error", "Error changing password");
    res.redirect("/api/users/change-password");
  }
};

// Show forgot password form
exports.showForgotForm = (req, res) => {
  res.render("forgot-password", {
    title: "Forgot Password",
    error: req.query.error,
    success: req.query.success,
  });
};

// Request password reset
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
      text: `You requested a password reset.\n\nClick the link below to reset your password:\n\n${resetLink}\n\nIf you didn't request this, you can ignore the email.`,
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

// Show reset password form
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

  res.render("reset-password", {
    token,
    email: user.email,
    error: req.query.error,
    success: req.query.success,
  });
};

// Handle new password submission

exports.resetPassword = async (req, res) => {
  const { token } = req.params;
  const { newPassword, confirmPassword } = req.body;

  if (newPassword !== confirmPassword) {
    req.flash("error", "Passwords do not match");
    return res.redirect(`/users/reset-password/${token}`);
  }

  try {
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      req.flash("error", "Invalid or expired reset token");
      return res.redirect("/users/forgot-password");
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

    req.flash("success", "Password reset successfully");
    res.redirect("/api/users/login");
  } catch (err) {
    console.error("Reset error:", err);
    req.flash("error", "Unexpected error occurred");
    res.redirect(`/users/reset-password/${token}`);
  }
};
