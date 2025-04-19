const mongoose = require("mongoose");
const passportLocalMongoose = require("passport-local-mongoose");

const userSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true },
  role: {
    type: String,
    enum: ["system_admin", "candidate"],
    required: true,
  },
  candidate: { type: mongoose.Schema.Types.ObjectId, ref: "Candidate" },
  hadLoggedIn: { type: Boolean, default: false },
  resetPasswordToken: String,
  resetPasswordExpires: Date,
});

// Add passport-local-mongoose plugin
userSchema.plugin(passportLocalMongoose, {
  usernameField: "email", // Use email instead of username
  errorMessages: {
    UserExistsError: "A user with the given email already exists",
  },
});

module.exports = mongoose.model("User", userSchema);
