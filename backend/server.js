const express = require("express");
const mongoose = require("mongoose");
const MongoStore = require("connect-mongo");
const dotenv = require("dotenv");
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const User = require("./models/User");
const connectDB = require("./config/db");
const cron = require("node-cron");
const Election = require("./models/Election");
// const insightsRoutes = require("./routes/insights");

dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();

// Session middleware (must come before passport.session)
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

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// Passport configuration
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

// View engine setup (critical for EJS)
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../frontend/views"));

// Flash messages middleware (optional but recommended for forms)
app.use((req, res, next) => {
  res.locals.messages = req.session.messages || {};
  delete req.session.messages;
  res.locals.user = req.user; // Make user available in all EJS templates
  next();
});

// Routes
// app.get("/", (req, res) => {
//   res.render("index", { user: req.user }); // Pass user to index.ejs
// });

// // Add the registration route (if not already in another file)
// app.get("/register", (req, res) => {
//   res.render("register", { user: req.user }); // Pass user to register.ejs
// });

app.get("/", (req, res) => {
  res.render("index", { user: req.user });
});

// Existing API routes
app.use("/", require("./routes/dashboard"));
app.use("/api/users", require("./routes/users"));
app.use("/api/elections", require("./routes/elections"));
app.use("/api/candidates", require("./routes/candidates"));
app.use("/api/votes", require("./routes/votes"));
app.use("/api/insights", require("./routes/insights"));

// app.use("/api", insightsRoutes);
// <-- important!
// app.use("/elections", require("./routes/elections"));

// 404 handler (ensure it uses EJS)
// app.use((req, res) => {
//   res.status(404).render("404", { title: "Page Not Found", user: req.user });
// });

// Centralized error handler (EJS-compatible)
// app.use((err, req, res, next) => {
//   console.error(err.stack);
//   res.status(500).render("error", {
//     title: "Error",
//     errorMessage: "Something went wrong",
//     errorDetail: process.env.NODE_ENV === "development" ? err.message : null,
//     user: req.user,
//   });
// });

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
