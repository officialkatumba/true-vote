const Joi = require("joi");
const mongoose = require("mongoose");

// ObjectId validator
const objectIdValidator = (value, helpers) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    return helpers.error("any.invalid");
  }
  return value;
};

const voteValidationSchema = Joi.object({
  electionId: Joi.string().custom(objectIdValidator).required(),
  candidateId: Joi.string().custom(objectIdValidator).required(),
  // voucherId: Joi.string().custom(objectIdValidator).optional(), // Changed to required
  voucher: Joi.any().forbidden(),

  voteTime: Joi.date().default(Date.now), // Added default

  age: Joi.number().integer().min(18).required(),
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
  // Removed employmentStatus as it's commented out in schema
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
  // religiousStatus: Joi.string()
  //   .valid("not religious", "slightly religious", "very religious")
  //   .required(),

  religiousStatus: Joi.string()
    .valid(
      "Catholic",
      "Anglican",
      "United Church of Zambia (UCZ)",
      "Methodist",
      "Protestant (Mainline)",
      "Pentecostal",
      "Adventist",
      "Jehovah’s Witness",
      "Independent Christian",
      "Not aligned Christian",
      "Islamic",
      "Traditionalist",
      "Not aligned"
    )
    .required(),
  dwellingType: Joi.string().valid("urban", "rural").required(),
  familyDwellingType: Joi.string().valid("urban", "rural").required(),

  provinceOfStudy: Joi.string().required(),
  schoolCompletionLocation: Joi.string().required(),
  // district: Joi.string().optional(),
  // constituency: Joi.string().optional(),
  votingEligibility2026: Joi.string().valid("yes", "no", "not_sure").required(),

  // Replaced averageMonthlyRent with incomeLevel
  incomeLevel: Joi.string()
    .valid("low", "medium", "high")
    .default("medium")
    .required(),

  sectorOfOperation: Joi.string()
    .valid("employee", "marketeer", "unemployed", "trader")
    .required(),

  // Removed dislikesAboutCandidate as it's commented out in schema
  expectationsFromCandidate: Joi.string().trim().optional(),

  relativeVoteLikelihood: Joi.boolean().required(),
  reasonForRelativeVote: Joi.string().required(),

  reasonForVoting: Joi.string().required(),
  usualPartySupport: Joi.string().required(),

  familiarWithPolicies: Joi.boolean().required(),
  policyUnderstanding: Joi.string().trim().optional(),
});

module.exports = { voteValidationSchema };
