const mongoose = require("mongoose");
const env = require("./env");

const connectDatabase = async () => {
  mongoose.set("strictQuery", true);

  await mongoose.connect(env.MONGODB_URI, {
    autoIndex: env.NODE_ENV !== "production",
  });
};

module.exports = connectDatabase;
