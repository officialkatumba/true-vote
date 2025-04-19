const express = require("express");
const router = express.Router();
// const ensureAuthenticated = require("../middleware/auth");

// module.exports = function ensureAuthenticated(req, res, next) {
//     if (req.isAuthenticated()) return next();
//     res.redirect("/api/users/login");
//   };

router.get("/candidate-dashboard", (req, res) => {
  res.render("candidate-dashboard", { user: req.user });
});

router.get("/admin-dashboard", (req, res) => {
  res.render("admin-dashboard", { user: req.user });
});

module.exports = router;
