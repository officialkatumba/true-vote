// // validations/rejection.js
// const Joi = require("joi");

// // Custom validator for ObjectId
// const objectIdValidator = (value, helpers) => {
//   if (!mongoose.Types.ObjectId.isValid(value)) {
//     return helpers.error("any.invalid");
//   }
//   return value;
// };

// const rejectionValidationSchema = Joi.object({
//   // Required fields
//   election: Joi.string().required(),
//   reason: Joi.string().required(),
//   relativeVoteLikelihood: Joi.boolean().required(),
//   voucher: Joi.string().required(),

//   // Optional demographic fields
//   age: Joi.number().optional(),
//   gender: Joi.string().valid("male", "female", "other").optional(),
//   highestEducation: Joi.string()
//     .valid(
//       "none",
//       "primary",
//       "secondary",
//       "diploma",
//       "bachelor",
//       "master",
//       "PhD"
//     )
//     .optional(),
//   employmentStatus: Joi.string()
//     .valid("employed", "unemployed", "self-employed", "student")
//     .optional(),
//   maritalStatus: Joi.string()
//     .valid(
//       "single",
//       "married",
//       "divorced",
//       "married parent",
//       "single mom",
//       "single dad"
//     )
//     .optional(),
//   religiousStatus: Joi.string()
//     .valid("not religious", "slightly religious", "very religious")
//     .optional(),
//   dwellingType: Joi.string().valid("urban", "rural").optional(),
//   familyDwellingType: Joi.string().valid("urban", "rural").optional(),

//   // Optional location fields
//   provinceOfStudy: Joi.string().optional(),
//   schoolCompletionLocation: Joi.string().optional(),
//   district: Joi.string().optional(),
//   constituency: Joi.string().optional(),

//   // Optional economic fields
//   averageMonthlyRent: Joi.number().optional(),
//   sectorOfOperation: Joi.string()
//     .valid(
//       "marketeer",
//       "online trader",
//       "cross-border trader",
//       "small business owner",
//       "street vendor"
//     )
//     .optional(),

//   // Optional opinion fields
//   dislikesAboutCandidate: Joi.string().optional(),
//   expectationsFromCandidate: Joi.string().optional(),
//   reasonForRelativeVote: Joi.string().optional(),
//   usualPartySupport: Joi.string().optional(),
//   familiarWithPolicies: Joi.boolean().optional(),
//   policyUnderstanding: Joi.string().optional(),
// });

// module.exports = rejectionValidationSchema;

const Joi = require("joi");
const mongoose = require("mongoose");

// Custom validator for ObjectId
const objectIdValidator = (value, helpers) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    return helpers.error("any.invalid");
  }
  return value;
};

const rejectionValidationSchema = Joi.object({
  electionId: Joi.string().custom(objectIdValidator).required(), // changed key here
  reason: Joi.string().required(),
  relativeVoteLikelihood: Joi.boolean().required(),
  voucher: Joi.string().custom(objectIdValidator).optional(), // add validation for voucher as ObjectId

  // Optional demographic fields
  age: Joi.number().optional(),
  gender: Joi.string().valid("male", "female", "other").optional(),
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
    .optional(),
  employmentStatus: Joi.string()
    .valid("employed", "unemployed", "self-employed", "student")
    .optional(),
  maritalStatus: Joi.string()
    .valid(
      "single",
      "married",
      "divorced",
      "married parent",
      "single mom",
      "single dad"
    )
    .optional(),
  religiousStatus: Joi.string()
    .valid("not religious", "slightly religious", "very religious")
    .optional(),
  dwellingType: Joi.string().valid("urban", "rural").optional(),
  familyDwellingType: Joi.string().valid("urban", "rural").optional(),

  // Optional location fields
  provinceOfStudy: Joi.string().optional(),
  schoolCompletionLocation: Joi.string().optional(),
  district: Joi.string().optional(),
  constituency: Joi.string().optional(),

  // Optional economic fields
  averageMonthlyRent: Joi.number().optional(),
  sectorOfOperation: Joi.string()
    .valid(
      "marketeer",
      "online trader",
      "cross-border trader",
      "small business owner",
      "street vendor"
    )
    .optional(),

  // Optional opinion fields
  dislikesAboutCandidate: Joi.string().optional(),
  expectationsFromCandidate: Joi.string().optional(),
  reasonForRelativeVote: Joi.string().optional(),
  usualPartySupport: Joi.string().optional(),
  familiarWithPolicies: Joi.boolean().optional(),
  policyUnderstanding: Joi.string().optional(),
});

module.exports = rejectionValidationSchema;
