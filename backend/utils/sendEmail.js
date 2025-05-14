// const nodemailer = require("nodemailer");

// require("dotenv").config();

// const transporter = nodemailer.createTransport({
//   service: "Gmail", // or your preferred provider
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASS,
//   },
// });

// module.exports = async function sendEmail({ to, subject, text }) {
//   await transporter.sendMail({
//     from: process.env.EMAIL_USER,
//     to,
//     subject,
//     text,
//   });
// };

// // utils/sendEmail.js
// const nodemailer = require("nodemailer");

// const sendEmail = async ({ to, subject, text }) => {
// const transporter = nodemailer.createTransport({
// host: process.env.EMAIL_HOST,
// port: parseInt(process.env.EMAIL_PORT, 10),
// secure: false,
// auth: {
// user: process.env.EMAIL_USER,
// pass: process.env.EMAIL_PASS,
// },
// });

// await transporter.sendMail({
// from: "Real Vote" ${process.env.EMAIL_USER},
// to,
// subject,
// text,
// });
// };

// utils/sendEmail.js
const nodemailer = require("nodemailer");
require("dotenv").config();

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || "smtp.gmail.com", // Default to Gmail if no host specified
  port: parseInt(process.env.EMAIL_PORT, 10) || 587, // Default to 587 if no port specified
  secure: process.env.EMAIL_SECURE === "true", // Convert string to boolean
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Sends an email using configured SMTP settings
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Email plain text content
 */
const sendEmail = async ({ to, subject, text }) => {
  try {
    await transporter.sendMail({
      from: `"Real Vote" <${process.env.EMAIL_USER}>`, // Branded sender name
      to,
      subject,
      text,
      // html: '<p>HTML version here</p>' // Uncomment to add HTML version
    });
    console.log(`Email sent to ${to}`);
  } catch (error) {
    console.error("Error sending email:", error);
    throw new Error("Failed to send email");
  }
};

module.exports = sendEmail;
