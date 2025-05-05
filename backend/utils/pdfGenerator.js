// const fs = require("fs");
// const path = require("path");
// const PdfPrinter = require("pdfmake");

// const fonts = {
//   Roboto: {
//     normal: "node_modules/pdfmake/fonts/Roboto-Regular.ttf",
//     bold: "node_modules/pdfmake/fonts/Roboto-Medium.ttf",
//     italics: "node_modules/pdfmake/fonts/Roboto-Italic.ttf",
//     bolditalics: "node_modules/pdfmake/fonts/Roboto-MediumItalic.ttf",
//   },
// };
// const printer = new PdfPrinter(fonts);

// const generateInsightPDF = async ({ candidate, election, insights }) => {
//   // Validate required parameters
//   if (!candidate || typeof candidate !== "object") {
//     throw new Error("Invalid candidate object provided");
//   }
//   if (!election || typeof election !== "object") {
//     throw new Error("Invalid election object provided");
//   }
//   if (!insights || typeof insights !== "object") {
//     throw new Error("Invalid insights object provided");
//   }

//   // Ensure required fields exist with fallbacks
//   const candidateName = candidate.name || "Unknown Candidate";
//   const candidateNumber = candidate.candidateNumber || "000";
//   const electionType = election.type || "Unknown Election Type";
//   const electionNumber = election.electionNumber || "0";

//   const docDefinition = {
//     content: [
//       { text: `AI Insight Report`, style: "header" },
//       { text: `Candidate: ${candidateName}`, style: "subheader" },
//       {
//         text: `Election: ${electionType} #${electionNumber}`,
//         style: "subheader",
//       },
//       "\n",
//       ...Object.entries(insights).map(([section, content]) => ({
//         text: [
//           { text: `${section}\n`, style: "sectionHeader" },
//           {
//             text: content || "No insight available.\n\n",
//             style: "sectionBody",
//           },
//         ],
//       })),
//     ],
//     styles: {
//       header: {
//         fontSize: 22,
//         bold: true,
//         alignment: "center",
//         margin: [0, 0, 0, 20],
//       },
//       subheader: { fontSize: 14, bold: true, margin: [0, 5, 0, 10] },
//       sectionHeader: {
//         fontSize: 16,
//         bold: true,
//         color: "#1565C0",
//         margin: [0, 10, 0, 4],
//       },
//       sectionBody: { fontSize: 12, margin: [0, 0, 0, 10] },
//     },
//   };

//   try {
//     const pdfDir = path.join(__dirname, "../backend/pdfs");
//     if (!fs.existsSync(pdfDir)) {
//       fs.mkdirSync(pdfDir, { recursive: true });
//     }

//     const fileName = `insight_${candidateNumber}_election${electionNumber}.pdf`;
//     const filePath = path.join(pdfDir, fileName);
//     const pdfDoc = printer.createPdfKitDocument(docDefinition);
//     const writeStream = fs.createWriteStream(filePath);
//     pdfDoc.pipe(writeStream);
//     pdfDoc.end();

//     await new Promise((resolve, reject) => {
//       writeStream.on("finish", resolve);
//       writeStream.on("error", reject);
//     });

//     return { fileName, filePath };
//   } catch (error) {
//     console.error("PDF generation failed:", error);
//     throw new Error("Failed to generate PDF");
//   }
// };

// module.exports = generateInsightPDF;
// const fs = require("fs");
// const path = require("path");
// const PdfPrinter = require("pdfmake");
// const { vfs } = require("pdfmake/build/vfs_fonts");

// const fonts = {
//   Roboto: {
//     normal: "Roboto-Regular.ttf",
//     bold: "Roboto-Medium.ttf",
//     italics: "Roboto-Italic.ttf",
//     bolditalics: "Roboto-MediumItalic.ttf",
//   },
// };

// const printer = new PdfPrinter(fonts);
// printer.vfs = vfs; // ✅ correctly link virtual fonts

// const generateInsightPDF = async ({ title, content, filePath }) => {
//   const docDefinition = {
//     content: [
//       { text: title, style: "header" },
//       { text: content, style: "content", margin: [0, 20, 0, 0] },
//     ],
//     styles: {
//       header: { fontSize: 18, bold: true, alignment: "center" },
//       content: { fontSize: 12 },
//     },
//     defaultStyle: {
//       font: "Roboto",
//     },
//     pageMargins: [40, 60, 40, 60],
//   };

//   return new Promise((resolve, reject) => {
//     try {
//       const pdfDoc = printer.createPdfKitDocument(docDefinition);
//       const stream = fs.createWriteStream(filePath);

//       pdfDoc.pipe(stream);
//       pdfDoc.end();

//       stream.on("finish", () => {
//         console.log("✅ PDF created at", filePath);
//         resolve();
//       });

//       stream.on("error", (err) => {
//         console.error("❌ PDF creation error:", err);
//         reject(err);
//       });
//     } catch (err) {
//       console.error("❌ Unexpected error generating PDF:", err);
//       reject(err);
//     }
//   });
// };

// module.exports = generateInsightPDF;

// backend/utils/pdfGenerator.js

// const fs = require("fs");
// const path = require("path");
// const PdfPrinter = require("pdfmake");
// const { vfs } = require("pdfmake/build/vfs_fonts");

// // Configure fonts - using Helvetica as fallback for better compatibility
// const fonts = {
//   Roboto: {
//     normal: "Helvetica",
//     bold: "Helvetica-Bold",
//     italics: "Helvetica-Oblique",
//     bolditalics: "Helvetica-BoldOblique",
//   },
// };

// const printer = new PdfPrinter(fonts);
// printer.vfs = vfs;

// /**
//  * Generates a PDF document with error handling and logging
//  * @param {Object} options - Configuration options for the PDF
//  * @param {string} options.title - Title of the document
//  * @param {string} options.content - Main content of the document
//  * @param {string} options.filePath - Full path where the PDF should be saved
//  * @param {Object} [options.metadata] - Optional metadata for the document
//  * @param {boolean} [options.logToConsole=true] - Whether to log progress to console
//  * @returns {Promise<string>} Resolves with the file path when successful
//  */
// const generateInsightPDF = async ({
//   title,
//   content,
//   filePath,
//   metadata = {},
//   logToConsole = true,
// }) => {
//   // Ensure the directory exists
//   const dir = path.dirname(filePath);
//   if (!fs.existsSync(dir)) {
//     fs.mkdirSync(dir, { recursive: true });
//   }

//   const docDefinition = {
//     content: [
//       { text: title, style: "header" },
//       { text: content, style: "content", margin: [0, 20, 0, 0] },

//       // Footer with metadata if provided
//       ...(metadata.generatedDate
//         ? [
//             { text: "\n" },
//             {
//               text: `Generated on: ${new Date(
//                 metadata.generatedDate
//               ).toLocaleString()}`,
//               style: "footer",
//               alignment: "right",
//             },
//           ]
//         : []),
//     ],
//     styles: {
//       header: {
//         fontSize: 18,
//         bold: true,
//         alignment: "center",
//         margin: [0, 0, 0, 10],
//       },
//       content: {
//         fontSize: 12,
//         lineHeight: 1.5,
//       },
//       footer: {
//         fontSize: 8,
//         color: "#666666",
//       },
//     },
//     defaultStyle: {
//       font: "Roboto",
//     },
//     pageMargins: [40, 60, 40, 60],
//     pageSize: "A4",
//     info: {
//       title: title,
//       author: metadata.author || "System Generated",
//       subject: metadata.subject || "Election Insights Report",
//       keywords: metadata.keywords || "election, insights, report",
//       creator: metadata.creator || "Election Insights System",
//     },
//   };

//   return new Promise((resolve, reject) => {
//     try {
//       const pdfDoc = printer.createPdfKitDocument(docDefinition);
//       const outputStream = fs.createWriteStream(filePath);

//       // Handle stream events
//       outputStream.on("finish", () => {
//         if (logToConsole) {
//           console.log(`✅ PDF successfully created at ${filePath}`);
//         }
//         resolve(filePath);
//       });

//       outputStream.on("error", (error) => {
//         if (logToConsole) {
//           console.error("❌ Stream error while generating PDF:", error);
//         }
//         reject(new Error(`PDF stream error: ${error.message}`));
//       });

//       // Pipe the PDF to the file
//       pdfDoc.pipe(outputStream);

//       // Additional error handling for the PDF document
//       pdfDoc.on("error", (error) => {
//         if (logToConsole) {
//           console.error("❌ PDF generation error:", error);
//         }
//         reject(new Error(`PDF generation failed: ${error.message}`));
//       });

//       pdfDoc.end();
//     } catch (error) {
//       if (logToConsole) {
//         console.error("❌ Unexpected error during PDF generation:", error);
//       }
//       reject(new Error(`PDF generation failed: ${error.message}`));
//     }
//   });
// };

const fs = require("fs");
const path = require("path");
const PdfPrinter = require("pdfmake");
const { vfs } = require("pdfmake/build/vfs_fonts");

// Configure fonts - using Helvetica as fallback for better compatibility
const fonts = {
  Roboto: {
    normal: "Helvetica",
    bold: "Helvetica-Bold",
    italics: "Helvetica-Oblique",
    bolditalics: "Helvetica-BoldOblique",
  },
};

const printer = new PdfPrinter(fonts);
printer.vfs = vfs;

/**
 * Generates a PDF document with error handling and logging
 * @param {Object} options - Configuration options for the PDF
 * @param {string} options.title - Title of the document
 * @param {string} options.content - Main content of the document
 * @param {string} options.filePath - Full path where the PDF should be saved
 * @param {Object} [options.metadata] - Optional metadata for the document
 * @param {boolean} [options.logToConsole=true] - Whether to log progress to console
 * @returns {Promise<string>} Resolves with the file path when successful
 */
const generateInsightPDF = async ({
  title,
  content,
  filePath,
  metadata = {},
  logToConsole = true,
}) => {
  // Ensure the directory exists
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const docDefinition = {
    content: [
      { text: title, style: "header" },
      { text: content, style: "content", margin: [0, 20, 0, 0] },

      // Footer with metadata if provided
      ...(metadata.generatedDate
        ? [
            { text: "\n" },
            {
              text: `Generated on: ${new Date(
                metadata.generatedDate
              ).toLocaleString()}`,
              style: "footer",
              alignment: "right",
            },
          ]
        : []),
    ],
    styles: {
      header: {
        fontSize: 18,
        bold: true,
        alignment: "center",
        margin: [0, 0, 0, 10],
      },
      content: {
        fontSize: 12,
        lineHeight: 1.5,
      },
      footer: {
        fontSize: 8,
        color: "#666666",
      },
    },
    defaultStyle: {
      font: "Roboto",
    },
    pageMargins: [40, 60, 40, 60],
    pageSize: "A4",
    info: {
      title: title,
      author: metadata.author || "System Generated",
      subject: metadata.subject || "Election Insights Report",
      keywords: metadata.keywords || "election, insights, report",
      creator: metadata.creator || "Election Insights System",
    },
  };

  return new Promise((resolve, reject) => {
    try {
      const pdfDoc = printer.createPdfKitDocument(docDefinition);
      const outputStream = fs.createWriteStream(filePath);

      // Handle stream events
      outputStream.on("finish", () => {
        if (logToConsole) {
          console.log(`✅ PDF successfully created at ${filePath}`);
        }
        resolve(filePath);
      });

      outputStream.on("error", (error) => {
        if (logToConsole) {
          console.error("❌ Stream error while generating PDF:", error);
        }
        reject(new Error(`PDF stream error: ${error.message}`));
      });

      // Pipe the PDF to the file
      pdfDoc.pipe(outputStream);

      // Additional error handling for the PDF document
      pdfDoc.on("error", (error) => {
        if (logToConsole) {
          console.error("❌ PDF generation error:", error);
        }
        reject(new Error(`PDF generation failed: ${error.message}`));
      });

      pdfDoc.end();
    } catch (error) {
      if (logToConsole) {
        console.error("❌ Unexpected error during PDF generation:", error);
      }
      reject(new Error(`PDF generation failed: ${error.message}`));
    }
  });
};

// Export as an object property
// exports.pdfGenerator = {
//   generateInsightPDF,
// };

module.exports = {
  pdfGenerator: {
    generateInsightPDF,
  },
};
