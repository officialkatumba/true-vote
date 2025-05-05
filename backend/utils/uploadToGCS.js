const path = require("path");
const fs = require("fs");
const { bucket } = require("../config/gcs");

const uploadPDFToGCS = async (filePath, fileName) => {
  const destination = `allinsight/${fileName}`;
  await bucket.upload(filePath, {
    destination,
    gzip: true,
    metadata: {
      cacheControl: "public, max-age=31536000",
    },
  });

  fs.unlinkSync(filePath); // Delete local copy
  return `https://storage.googleapis.com/${bucket.name}/${destination}`;
};

module.exports = uploadPDFToGCS;
