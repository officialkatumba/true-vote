const mongoose = require("mongoose");

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // Unique identifier (e.g., "electionNumber", "candidate")
  seq: { type: Number, default: 0 }, // Keeps track of the last used number
});

module.exports = mongoose.model("Counter", counterSchema);
