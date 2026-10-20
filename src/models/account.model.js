const mongoose = require("mongoose")

// Define account schema
const accountSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: [true, "Account must be associated with a user"],
        unique: true
    },
    status: {
        type: String,
        enum: {
            values: ["ACTIVE", "FROZEN", "CLOSED"],
            message: "Status can be either ACTIVE, FROZEN or CLOSED",
        },
        default: "ACTIVE"
    },
    currency: {
        type: String,
        required: [true, "Currency is required for creating an account"],
        default: "INR"
    },
    balance: {
        type: Number,
        default: 0,
        min: 0
    }
}, {
    timestamps: true
})

// Create a compound index for faster queries
accountSchema.index({
    user: 1,
    status: 1
})

// Method to calculate the current account balance
accountSchema.methods.getBalance = function () {
    return this.balance
}

// Create account model
const accountModel = mongoose.model("account", accountSchema)

module.exports = accountModel