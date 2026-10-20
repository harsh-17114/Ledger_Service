const mongoose = require("mongoose")

// Connect to MongoDB
async function connectDB() {
    try {
        // Connect using MongoDB URI
        await mongoose.connect(process.env.MONGODB_URI, {
            family: 4
        })
        console.log("Connection to Database successful")
    }
    catch (err) {
        console.error("Connection to Database failed", err)
        throw err
    }
}

module.exports = connectDB