const mongoose = require("mongoose");

const Counter = require("../models/Counter");

const voucherSchema = new mongoose.Schema({
  voucherNumber: {
    type: Number,
    unique: true,
  }, // Auto-incremented and unique starting from 987654321

  isRedeemed: {
    type: Boolean,
    default: false,
  }, // Whether it has been used

  redeemedBy: {
    type: String,
    required: false,
    trim: true,
  }, // Name of the person who used the voucher

  redeemedPhone: {
    type: String,
    required: false,
    trim: true,
  }, // Optional: phone number for follow-up or fraud control

  redeemedAt: {
    type: Date,
    required: false,
  }, // Date when voucher was redeemed
});

// Auto-increment voucherNumber starting from 987654321
voucherSchema.pre("save", async function (next) {
  if (this.isNew) {
    try {
      const counter = await Counter.findByIdAndUpdate(
        { _id: "voucher" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      this.voucherNumber = counter.seq + 987654321;
    } catch (err) {
      return next(err);
    }
  }
  next();
});

module.exports = mongoose.model("Voucher", voucherSchema);
