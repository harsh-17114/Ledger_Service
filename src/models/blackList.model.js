const mongoose = require("mongoose")

// Define blacklisted token schema
const tokenBlacklistSchema = new mongoose.Schema({
    token: {
        type: String,
        required: [true, "Token is required to blacklist"],
        unique: true
    }
}, {
    timestamps: true
})

tokenBlacklistSchema.index({
    createdAt: 1
}, {
    expireAfterSeconds: 60 * 60 * 24 * 3
})

// Create blacklisted token model
const tokenBlackListModel = mongoose.model("tokenBlackList", tokenBlacklistSchema)

module.exports = tokenBlackListModel