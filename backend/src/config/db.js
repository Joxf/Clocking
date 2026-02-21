const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoUrl = process.env.MONGO_URL;
    const dbName = process.env.DB_NAME;
    
    if (!mongoUrl) {
      throw new Error('MONGO_URL environment variable is required');
    }
    
    await mongoose.connect(mongoUrl, {
      dbName: dbName
    });
    
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
