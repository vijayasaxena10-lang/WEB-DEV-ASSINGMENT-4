const { MongoClient } = require("mongodb");

let db;

async function connectDB() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  db = client.db(process.env.DB_NAME || "secure_connect");
  await db.collection("users").createIndex({ email: 1 }, { unique: true });
  await db.collection("notes").createIndex({ owner: 1 });
  console.log("MongoDB connected");
  return db;
}

function getDB() {
  if (!db) throw new Error("Database is not connected");
  return db;
}

module.exports = { connectDB, getDB };
