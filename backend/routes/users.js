const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");

// LOGIN / LOGOUT
router.get("/login", userController.showLoginForm);
router.post("/login", userController.loginUser);
router.get("/logout", userController.logoutUser);

// PASSWORD CHANGE
router.get("/change-password", userController.showChangePasswordForm);
router.post("/change-password", userController.changePassword);

// PASSWORD RESET
router.get("/forgot-password", userController.showForgotForm);
router.get("/users/forgot-password", userController.showForgotForm); // if needed in multiple contexts
router.post("/forgot-password", userController.requestResetPassword);
router.get("/reset-password/:token", userController.showResetForm);
router.post("/reset-password/:token", userController.resetPassword);

module.exports = router;
