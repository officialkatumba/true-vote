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
  voucherId: Joi.string().custom(objectIdValidator).optional(),

  voteTime: Joi.date().optional(),

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
  employmentStatus: Joi.string()
    .valid("employed", "unemployed", "self-employed", "student")
    .required(),
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

  provinceOfStudy: Joi.string().required(),
  schoolCompletionLocation: Joi.string().required(),
  district: Joi.string().optional(),
  constituency: Joi.string().optional(),

  averageMonthlyRent: Joi.number().required(),
  sectorOfOperation: Joi.string()
    .valid(
      "marketeer",
      "online trader",
      "cross-border trader",
      "small business Owner",
      "street vendor"
    )
    .optional(),

  dislikesAboutCandidate: Joi.string().trim().optional(),
  expectationsFromCandidate: Joi.string().trim().optional(),

  relativeVoteLikelihood: Joi.boolean().required(),
  reasonForRelativeVote: Joi.string().required(),

  reasonForVoting: Joi.string().required(),
  usualPartySupport: Joi.string().required(),

  familiarWithPolicies: Joi.boolean().required(),
  policyUnderstanding: Joi.string().trim().optional(),
});

module.exports = { voteValidationSchema };
