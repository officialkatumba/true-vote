const Joi = require("joi");
const mongoose = require("mongoose");

const objectIdValidator = (value, helpers) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    return helpers.error("any.invalid");
  }
  return value;
};

const electionValidationSchema = Joi.object({
  type: Joi.string()
    .valid("presidential", "parliamentary", "mayoral", "councillor")
    .required(),

  startDate: Joi.date().required(),
  endDate: Joi.date().required(),

  electionContext: Joi.string().allow("").optional(),

  candidates: Joi.array()
    .items(Joi.string().custom(objectIdValidator))
    .default([]),

  createdBy: Joi.string().custom(objectIdValidator).required(),

  electionStatus: Joi.string()
    .valid("draft", "ongoing", "completed", "canceled")
    .default("draft"),

  // Optional: you usually won’t set this on create
  electionDurationMs: Joi.number().optional(),

  // Optional: usually system-set
  totalVotes: Joi.number().integer().min(0).default(0),
  voteRejected: Joi.number().integer().min(0).default(0),

  result: Joi.object()
    .pattern(
      Joi.string(), // candidateId
      Joi.number().min(0)
    )
    .optional(),
});

module.exports = { electionValidationSchema };
