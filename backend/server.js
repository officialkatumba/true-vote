// -------------------- IMPORTS --------------------
const express = require("express");
const mongoose = require("mongoose");
const MongoStore = require("connect-mongo");
const dotenv = require("dotenv");
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const flash = require("connect-flash");
const cron = require("node-cron");

const User = require("./models/User");
const Election = require("./models/Election");
const connectDB = require("./config/db");
require("./utils/autoLauncher");

// -------------------- CONFIG --------------------
dotenv.config();
connectDB();

const app = express();

// -------------------- SESSION (MongoDB Atlas) --------------------
app.set("trust proxy", 1); // Required when behind proxy (e.g. Heroku, Render)
app.use((req, res, next) => {
  const host = req.headers.host;
  if (host === "truevote.space") {
    return res.redirect(301, "https://www.truevote.space" + req.originalUrl);
  }
  next();
});

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    name: process.env.SESSION_COOKIE_NAME || "sid",
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI, // Your MongoDB Atlas URI
      collectionName: "sessions", // Optional custom collection name
      ttl: 60 * 60 * 2, // 2 hours (same as cookie maxAge)
      autoRemove: "native", // Clean expired sessions automatically
    }),
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // HTTPS only in production
      sameSite: "strict",
      maxAge: 1000 * 60 * 60 * 2, // 2 hours
    },
  })
);

// -------------------- FLASH & PASSPORT --------------------
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());

// Passport config
passport.use(
  new LocalStrategy({ usernameField: "email" }, User.authenticate())
);
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// -------------------- MIDDLEWARE --------------------
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// -------------------- STATIC & VIEWS --------------------
app.use(express.static(path.join(__dirname, "../frontend/public")));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../frontend/views"));

// -------------------- LOCALS --------------------
app.use((req, res, next) => {
  res.locals.success_msg = req.flash("success_msg");
  res.locals.error_msg = req.flash("error_msg");
  res.locals.error = req.flash("error");
  res.locals.user = req.user;
  next();
});

// -------------------- ROUTES --------------------
app.get("/", (req, res) => {
  res.render("index", { user: req.user });
});

app.use("/api/users", require("./routes/users"));
app.use("/api/elections", require("./routes/elections"));
app.use("/api/candidates", require("./routes/candidates"));
app.use("/api/votes", require("./routes/votes"));
app.use("/api/insights", require("./routes/insights"));

app.use("/", require("./routes/dashboard"));
app.use("/candidates", require("./routes/candidates"));
app.use("/users", require("./routes/users"));

app.get("/vote/voting-closed", (req, res) => {
  res.render("vote/voting-closed");
});

// -------------------- CRON JOBS --------------------

// Auto-complete elections
cron.schedule("* * * * *", async () => {
  try {
    const now = new Date();
    const result = await Election.updateMany(
      { electionStatus: "ongoing", endDate: { $lt: now } },
      { $set: { electionStatus: "completed" } }
    );
    if (result.modifiedCount > 0) {
      console.log(
        `🕒 Auto-ended ${
          result.modifiedCount
        } election(s) at ${now.toISOString()}`
      );
    }
  } catch (err) {
    console.error("❌ Cron job error:", err.message);
  }
});

// Auto-update membership status
cron.schedule("0 * * * *", async () => {
  try {
    const now = new Date();
    const result = await User.updateMany(
      { membershipStatus: "active", membershipExpiryDate: { $lt: now } },
      { $set: { membershipStatus: "pending" } }
    );
    if (result.modifiedCount > 0) {
      console.log(
        `⏳ Updated membership for ${
          result.modifiedCount
        } user(s) at ${now.toISOString()}`
      );
    }
  } catch (err) {
    console.error("❌ Membership cron error:", err.message);
  }
});

// -------------------- SERVER --------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
