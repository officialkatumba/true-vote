const express = require("express");
const mongoose = require("mongoose");
const MongoStore = require("connect-mongo");
const dotenv = require("dotenv");
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const flash = require("connect-flash"); // ✅ NEW
const User = require("./models/User");
const connectDB = require("./config/db");
const cron = require("node-cron");
const Election = require("./models/Election");

dotenv.config();
connectDB();

const app = express();

// Session middleware (must come before passport & flash)
app.use(
  session({
    secret: process.env.SESSION_SECRET || "yourSecret",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
      ttl: 2 * 60 * 60,
    }),
    name: "sessionId",
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 2,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    },
  })
);

// ✅ Flash middleware (must come after session)
app.use(flash());

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// Passport config
passport.use(
  new LocalStrategy({ usernameField: "email" }, User.authenticate())
);
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// Middleware
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Static files (served from /frontend/public)
app.use(express.static(path.join(__dirname, "../frontend/public")));

// View engine setup
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../frontend/views"));

// ✅ Set res.locals for flash messages and user
app.use((req, res, next) => {
  res.locals.success_msg = req.flash("success_msg");
  res.locals.error_msg = req.flash("error_msg");
  res.locals.error = req.flash("error"); // Passport-specific errors
  res.locals.user = req.user;
  next();
});

// Basic routes
app.get("/", (req, res) => {
  res.render("index", { user: req.user });
});

// // API routes
app.use("/", require("./routes/dashboard"));
app.use("/api/users", require("./routes/users"));
app.use("/api/elections", require("./routes/elections"));
app.use("/api/candidates", require("./routes/candidates"));
app.use("/api/votes", require("./routes/votes"));
app.use("/api/insights", require("./routes/insights"));

// Non-API view routes
app.use("/candidates", require("./routes/candidates"));
app.use("/users", require("./routes/users"));

// // View Routes (for rendering pages)
// app.use("/candidates", require("./routes/candidates")); // Handles pages like /candidates/register
// app.use("/users", require("./routes/users"));
// app.use("/", require("./routes/dashboard")); // Root-level pages

// // API Routes (for handling backend POST/GET requests)
// app.use("/api/users", require("./routes/api/users"));
// app.use("/api/elections", require("./routes/api/elections"));
// app.use("/api/candidates", require("./routes/api/candidates")); // Handles form submissions like /api/candidates/register
// app.use("/api/votes", require("./routes/api/votes"));
// app.use("/api/insights", require("./routes/api/insights"));

// Cron: Auto-complete elections
cron.schedule("* * * * *", async () => {
  try {
    const now = new Date();
    const result = await Election.updateMany(
      {
        electionStatus: "ongoing",
        endDate: { $lt: now },
      },
      {
        $set: { electionStatus: "completed" },
      }
    );

    if (result.modifiedCount > 0) {
      console.log(
        `🕒 Cron: Auto-ended ${
          result.modifiedCount
        } election(s) at ${now.toISOString()}`
      );
    }
  } catch (err) {
    console.error("❌ Cron job error:", err.message);
  }
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
