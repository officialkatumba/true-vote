// // const express = require("express");
// // const router = express.Router();
// // const {
// //   showLoginForm,
// //   loginUser,
// //   logoutUser,
// //   userController,
// // } = require("../controllers/userController");

// // // Login form
// // router.get("/login", showLoginForm);

// // // Login handler
// // router.post("/login", loginUser);

// // // Logout
// // router.get("/logout", logoutUser);

// // // Password change routes
// // router.get(
// //   "/change-password",
// //   // isLoggedIn,
// //   userController.showChangePasswordForm
// // );
// // router.post(
// //   "/change-password",
// //   // isLoggedIn,
// //   userController.changePassword
// // );

// // module.exports = router;

// const express = require("express");
// const router = express.Router();
// const userController = require("../controllers/userController");

// // Login form
// router.get("/login", userController.showLoginForm);

// // Login handler
// router.post("/login", userController.loginUser);

// // Logout
// router.get("/logout", userController.logoutUser);

// // Password change routes
// router.get("/change-password", userController.showChangePasswordForm);
// router.post("/change-password", userController.changePassword);

// // GET
// router.get("/forgot-password", userController.showForgotForm);
// router.get("/reset-password/:token", userController.showResetForm);

// // POST
// router.post("/forgot-password", userController.requestResetPassword);

// router.post("/reset-password/:token", userController.resetPassword);

// // Show forgot password form
// router.get("/forgot-password", userController.showForgotForm);

// // ADD THIS:
// router.get("/reset-password/:token", userController.showResetForm);

// // Also include the others:
// router.post("/forgot-password", userController.requestResetPassword);
// router.post("/reset-password/:token", userController.resetPassword);
// router.get("/users/forgot-password", userController.showForgotForm);

// module.exports = router;

const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");

// ==========================
// LOGIN / LOGOUT
// ==========================

// Show login form
router.get("/login", userController.showLoginForm);

// Handle login
router.post("/login", userController.loginUser);

// Logout
router.get("/logout", userController.logoutUser);

// ==========================
// PASSWORD CHANGE (Logged-in Users)
// ==========================

// Show change password form
router.get("/change-password", userController.showChangePasswordForm);

// Submit password change
router.post("/change-password", userController.changePassword);

// ==========================
// PASSWORD RESET FLOW (Forgot Password)
// ==========================

// Show forgot password form
router.get("/forgot-password", userController.showForgotForm);

// Also allow this for consistency with your flow
router.get("/users/forgot-password", userController.showForgotForm);

// Handle forgot password form submission (send reset email)
router.post("/forgot-password", userController.requestResetPassword);

// Show reset password form (from email link)
router.get("/reset-password/:token", userController.showResetForm);

// Handle new password submission using token
router.post("/reset-password/:token", userController.resetPassword);

module.exports = router;
