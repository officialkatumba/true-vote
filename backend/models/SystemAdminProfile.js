// models/SystemAdminProfile.js
const mongoose = require("mongoose");

const systemAdminProfileSchema = new mongoose.Schema({
  name: { type: String, required: true }, // Admin's full name
  mobile: { type: String, required: true }, // Admin's mobile number
  profileImage: { type: String }, // Optional URL for admin's profile picture

  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  }, // Linked User account (must have role: 'system_admin')

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("SystemAdminProfile", systemAdminProfileSchema);
