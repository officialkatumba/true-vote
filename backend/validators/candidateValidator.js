const Joi = require("joi");
const mongoose = require("mongoose");

const objectIdValidator = (value, helpers) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    return helpers.error("any.invalid");
  }
  return value;
};

const candidateValidationSchema = Joi.object({
  // User-related fields
  email: Joi.string().email().required().label("Email"),
  password: Joi.string().min(6).required().label("Password"),

  // Candidate-related fields
  name: Joi.string().required().label("Candidate Name"),
  bio: Joi.string().required(),
  mobile: Joi.string().required().label("Mobile Number"),
  party: Joi.string().default("Independent"),
  profileImage: Joi.string().uri().optional(),
  partySymbol: Joi.string().uri().optional(),
  registeredForElectionType: Joi.string()
    .valid("presidential", "parliamentary", "mayoral", "councillor")
    .required(),

  membershipStatus: Joi.string()
    .valid("active", "pending", "expired")
    .default("pending"),
  membershipExpiresOn: Joi.date().optional(),

  hasCalledAnElection: Joi.boolean().default(false),
  electionsCalled: Joi.number().integer().min(0).default(0),
  electionsJoined: Joi.number().integer().min(0).default(0),

  elections: Joi.array()
    .items(Joi.string().custom(objectIdValidator))
    .optional(),
  invitedElections: Joi.array()
    .items(Joi.string().custom(objectIdValidator))
    .optional(),

  user: Joi.string().custom(objectIdValidator).optional(), // allow optional for now since user doesn't exist yet
});

module.exports = { candidateValidationSchema };
