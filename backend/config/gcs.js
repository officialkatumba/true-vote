const { Storage } = require("@google-cloud/storage");
const path = require("path");

const storage = new Storage({
  keyFilename: path.join(__dirname, "../key.json"),
});

const bucketName = "truevote-insight";
const bucket = storage.bucket(bucketName);

module.exports = { bucket };
