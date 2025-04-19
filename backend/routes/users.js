const express = require("express");
const router = express.Router();
const {
  showLoginForm,
  loginUser,
  logoutUser,
} = require("../controllers/userController");

// Login form
router.get("/login", showLoginForm);

// Login handler
router.post("/login", loginUser);

// Logout
router.get("/logout", logoutUser);

module.exports = router;
