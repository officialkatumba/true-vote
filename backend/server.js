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
require("./utils/autoLauncher");

dotenv.config();
connectDB();

const Redis = require("ioredis");
const RedisStore = require("connect-redis").default; // Correct for v7.1.1

const app = express();

// Session middleware (must come before passport & flash)
// app.use(
//   session({
//     secret: process.env.SESSION_SECRET || "yourSecret",
//     resave: false,
//     saveUninitialized: false,
//     store: MongoStore.create({
//       mongoUrl: process.env.MONGO_URI,
//       ttl: 2 * 60 * 60,
//     }),
//     name: "sessionId",
//     cookie: {
//       httpOnly: true,
//       maxAge: 1000 * 60 * 60 * 2,
//       secure: process.env.NODE_ENV === "production",
//       sameSite: "strict",
//     },
//   })
// );

// Redis client setup

// const redisClient = new Redis({
//   host: process.env.REDIS_HOST,
//   port: process.env.REDIS_PORT,
//   password: process.env.REDIS_PASSWORD,
//   tls: process.env.NODE_ENV === "production" ? {} : undefined,
// });

const redisOptions = {
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD,
};

// Only enable TLS if explicitly told to
if (process.env.REDIS_USE_TLS === "true") {
  redisOptions.tls = {};
}

const redisClient = new Redis(redisOptions);

// Optional: log connection events
redisClient.on("connect", () => {
  console.log("✅ Connected to Redis");
});
redisClient.on("error", (err) => {
  console.error("❌ Redis error:", err);
});

// Trust proxy
app.set("trust proxy", 1);

app.use(
  session({
    store: new RedisStore({ client: redisClient }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    name: process.env.SESSION_COOKIE_NAME || "sid",
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 1000 * 60 * 60 * 2,
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
app.use("/api/users", require("./routes/users"));
app.use("/api/elections", require("./routes/elections"));
app.use("/api/candidates", require("./routes/candidates"));
app.use("/api/votes", require("./routes/votes"));
app.use("/api/insights", require("./routes/insights"));

// Non-API view routes
app.use("/", require("./routes/dashboard"));
app.use("/candidates", require("./routes/candidates"));
app.use("/users", require("./routes/users"));

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
