// validators/rejectionValidator.js
const Joi = require("joi");
const mongoose = require("mongoose");

const objectId = (value, helpers) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    return helpers.error("any.invalid");
  }
  return value;
};

const rejectionJoiSchema = Joi.object({
  election: Joi.string().custom(objectId).required(),
  // voucher: Joi.string().custom(objectId).required(),
  voucher: Joi.any().forbidden(),

  // reason: Joi.string().optional(),

  // Demographics
  age: Joi.number().min(0).max(150).optional(),
  gender: Joi.string().valid("male", "female", "other").required(),
  highestEducation: Joi.string()
    .valid(
      "none",
      "primary",
      "secondary",
      "diploma",
      "bachelor",
      "master",
      "PhD"
    )
    .required(),
  incomeLevel: Joi.string().valid("low", "medium", "high").required(),
  maritalStatus: Joi.string()
    .valid(
      "single",
      "married",
      "divorced",
      "married parent",
      "single mom",
      "single dad"
    )
    .required(),
  religiousStatus: Joi.string()
    .valid("not religious", "slightly religious", "very religious")
    .required(),
  dwellingType: Joi.string().valid("urban", "rural").required(),
  familyDwellingType: Joi.string().valid("urban", "rural").required(),

  // Education
  provinceOfStudy: Joi.string().required(),
  schoolCompletionLocation: Joi.string().required(),

  // Voting eligibility
  votingEligibility2026: Joi.string().valid("yes", "no", "not_sure").required(),

  // Financial
  sectorOfOperation: Joi.string()
    .valid("employee", "marketeer", "unemployed", "trader")
    .required(),

  // Insights
  relativeVoteLikelihood: Joi.boolean().required(),
  reasonForRelativeVote: Joi.string().required(),
  expectationsFromCandidate: Joi.string().allow(""),
  usualPartySupport: Joi.string().required(),
  reasonForVoting: Joi.string().required(),
  familiarWithPolicies: Joi.boolean().required(),
  policyUnderstanding: Joi.string().allow(""),

  // Optional client-side field
  submittedAt: Joi.date().optional(),
});

module.exports = rejectionJoiSchema;
