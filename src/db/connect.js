const mongoose = require("mongoose");
require("dotenv").config();

const connectDb = () => {
  const databaseUrl = process.env.MONGO_URI;
  mongoose
    .connect(databaseUrl, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log("MongoDB connected"))
    .catch((err) => console.error("MongoDB connection error:", err));
};

module.exports = {
  connectDb,
};
