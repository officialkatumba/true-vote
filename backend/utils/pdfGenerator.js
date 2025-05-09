// const fs = require("fs");
// const path = require("path");
// const PdfPrinter = require("pdfmake");
// const { vfs } = require("pdfmake/build/vfs_fonts");

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

// const generateInsightPDF = async ({
//   sectionTitle,
//   content,
//   filePath,
//   electionDetails,
//   metadata = {},
//   logToConsole = true,
// }) => {
//   const dir = path.dirname(filePath);
//   if (!fs.existsSync(dir)) {
//     fs.mkdirSync(dir, { recursive: true });
//   }

//   const docDefinition = {
//     content: [
//       {
//         text: "CONFIDENTIAL",
//         color: "#ff0000",
//         bold: true,
//         fontSize: 12,
//         alignment: "center",
//         margin: [0, 0, 0, 10], // topmost
//       },
//       {
//         text: "ELECTION INSIGHT REPORT",
//         color: "#2c3e50",
//         bold: true,
//         fontSize: 18,
//         alignment: "center",
//         margin: [0, 0, 0, 5], // small gap before section title
//       },
//       {
//         text: sectionTitle.toUpperCase(),
//         style: "sectionTitle",
//         margin: [0, 10, 0, 5],
//       },
//       {
//         text: `Type: ${
//           electionDetails?.type?.toUpperCase() || "N/A"
//         } | Election #${electionDetails?.electionNumber || "N/A"}`,
//         style: "electionMeta",
//         alignment: "center",
//       },
//       {
//         text: `Election Date: ${
//           new Date(electionDetails?.startDate).toLocaleDateString() || "N/A"
//         } | Report Date: ${new Date().toLocaleDateString()}`,
//         style: "electionMeta",
//         alignment: "center",
//         margin: [0, 0, 0, 20],
//       },
//       {
//         text: content,
//         style: "content",
//         margin: [0, 10, 0, 20],
//       },
//       {
//         text: "--- End of Report ---",
//         style: "footer",
//         margin: [0, 20, 0, 0],
//       },
//     ],

//     footer: function (currentPage, pageCount) {
//       return {
//         columns: [
//           {
//             text: `Page ${currentPage} of ${pageCount}`,
//             alignment: "left",
//             style: "pageNumber",
//             margin: [40, 0, 0, 20],
//           },
//           {
//             text: "© Election Insights System",
//             alignment: "right",
//             style: "copyright",
//             margin: [0, 0, 40, 20],
//           },
//         ],
//       };
//     },

//     styles: {
//       sectionTitle: {
//         fontSize: 16,
//         bold: true,
//         color: "#2c3e50",
//         alignment: "center",
//       },
//       electionMeta: {
//         fontSize: 10,
//         color: "#555555",
//       },
//       content: {
//         fontSize: 12,
//         lineHeight: 1.5,
//       },
//       footer: {
//         fontSize: 10,
//         color: "#2c3e50",
//         alignment: "center",
//         italics: true,
//         bold: true,
//       },
//       pageNumber: {
//         fontSize: 9,
//         color: "#666666",
//       },
//       copyright: {
//         fontSize: 9,
//         color: "#666666",
//       },
//     },

//     defaultStyle: {
//       font: "Roboto",
//     },

//     pageMargins: [40, 60, 40, 80], // Reduced top margin to bring CONFIDENTIAL to the top
//     pageSize: "A4",
//     info: {
//       title: `${sectionTitle} - Election Insight`,
//       author: "Election Insights System",
//       subject: "Campaign Analysis Report",
//       keywords: "election, insights, confidential",
//     },
//   };

//   return new Promise((resolve, reject) => {
//     try {
//       const pdfDoc = printer.createPdfKitDocument(docDefinition);
//       const outputStream = fs.createWriteStream(filePath);

//       outputStream.on("finish", () => {
//         if (logToConsole) console.log(`PDF created: ${filePath}`);
//         resolve(filePath);
//       });

//       outputStream.on("error", (error) => {
//         console.error("PDF stream error:", error);
//         reject(error);
//       });

//       pdfDoc.pipe(outputStream);
//       pdfDoc.end();
//     } catch (error) {
//       console.error("PDF generation error:", error);
//       reject(error);
//     }
//   });
// };

// module.exports = {
//   generateInsightPDF,
// };

const fs = require("fs");
const path = require("path");
const PdfPrinter = require("pdfmake");
const { vfs } = require("pdfmake/build/vfs_fonts");

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

const generateInsightPDF = async ({
  sectionTitle,
  content,
  filePath,
  electionDetails,
  metadata = {},
  logToConsole = true,
}) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const docDefinition = {
    background: function (currentPage, pageSize) {
      return {
        text: "CONFIDENTIAL",
        color: "red",
        opacity: 0.15,
        bold: true,
        fontSize: 50,
        angle: -45,
        absolutePosition: {
          x: pageSize.width / 4,
          y: pageSize.height / 2,
        },
      };
    },

    content: [
      {
        text: "CONFIDENTIAL",
        color: "#ff0000",
        bold: true,
        fontSize: 20,
        alignment: "center",
        margin: [0, 0, 0, 10],
      },
      {
        text: "ELECTION INSIGHT REPORT",
        color: "#2c3e50",
        bold: true,
        fontSize: 18,
        alignment: "center",
        margin: [0, 0, 0, 5],
      },
      {
        text: sectionTitle.toUpperCase(),
        style: "sectionTitle",
        margin: [0, 10, 0, 5],
      },
      {
        text: `Type: ${
          electionDetails?.type?.toUpperCase() || "N/A"
        } | Election #${electionDetails?.electionNumber || "N/A"}`,
        style: "electionMeta",
        alignment: "center",
      },
      {
        text: `Election Date: ${
          new Date(electionDetails?.startDate).toLocaleDateString() || "N/A"
        } | Report Date: ${new Date().toLocaleDateString()}`,
        style: "electionMeta",
        alignment: "center",
        margin: [0, 0, 0, 20],
      },
      {
        text: content,
        style: "content",
        margin: [0, 10, 0, 20],
      },
      {
        text: "--- End of Report ---",
        style: "footer",
        margin: [0, 20, 0, 0],
      },
    ],

    footer: function (currentPage, pageCount) {
      return {
        columns: [
          {
            text: `Page ${currentPage} of ${pageCount}`,
            alignment: "left",
            style: "pageNumber",
            margin: [40, 0, 0, 20],
          },
          {
            text: "© Election Insights System",
            alignment: "right",
            style: "copyright",
            margin: [0, 0, 40, 20],
          },
        ],
      };
    },

    styles: {
      sectionTitle: {
        fontSize: 14,
        bold: true,
        color: "#2c3e50",
        alignment: "center",
      },
      electionMeta: {
        fontSize: 10,
        color: "#555555",
      },
      content: {
        fontSize: 12,
        lineHeight: 1.5,
      },
      footer: {
        fontSize: 10,
        color: "#2c3e50",
        alignment: "center",
        italics: true,
        bold: true,
      },
      pageNumber: {
        fontSize: 9,
        color: "#666666",
      },
      copyright: {
        fontSize: 9,
        color: "#666666",
      },
    },

    defaultStyle: {
      font: "Roboto",
    },

    pageMargins: [40, 60, 40, 80],
    pageSize: "A4",
    info: {
      title: `${sectionTitle} - Election Insight`,
      author: "Election Insights System",
      subject: "Campaign Analysis Report",
      keywords: "election, insights, confidential",
    },
  };

  return new Promise((resolve, reject) => {
    try {
      const pdfDoc = printer.createPdfKitDocument(docDefinition);
      const outputStream = fs.createWriteStream(filePath);

      outputStream.on("finish", () => {
        if (logToConsole) console.log(`PDF created: ${filePath}`);
        resolve(filePath);
      });

      outputStream.on("error", (error) => {
        console.error("PDF stream error:", error);
        reject(error);
      });

      pdfDoc.pipe(outputStream);
      pdfDoc.end();
    } catch (error) {
      console.error("PDF generation error:", error);
      reject(error);
    }
  });
};

module.exports = {
  generateInsightPDF,
};
