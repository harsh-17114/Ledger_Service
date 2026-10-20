const mongoose = require("mongoose")
const accountModel = require("../models/account.model.js")

// Create a new account for the authenticated user
async function createAccountController(req, res) {
    const user = req.user
    try {
        // Check whether the user already has an account
        const existingAccount = await accountModel.findOne({ user: req.user._id })

        // Prevent the user from creating multiple accounts
        if (existingAccount) {
            return res.status(409).json({
                message: "User already has an account"
            })
        }

        // Create a new account
        const account = await accountModel.create({ user: user._id })

        // Send the newly created account in the response
        res.status(201).json({
            message: "Account created successfully",
            account
        })
    }
    catch (err) {
        console.error("Create account error:", err)

        // Handle duplicate account creation
        if (err.code === 11000) {
            return res.status(409).json({
                message: "User already has an account"
            })
        }

        // Return a server error response
        return res.status(500).json({
            message: "Internal server error"
        })
    }
}

// Get all accounts belonging to the authenticated user
async function getUserAccountsController(req, res) {
    try {
        // Find all accounts where the user ID matches
        const accounts = await accountModel.find({ user: req.user._id })

        // Return the user's accounts
        res.status(200).json({
            message: "Account details fetched successfully",
            accounts
        })
    }
    catch (err) {
        console.error("Get accounts error:", err)

        // Return a server error response
        return res.status(500).json({
            message: "Internal server error"
        })
    }
}

// Get the balance of a specific account
async function getAccountBalanceController(req, res) {
    const { accountId } = req.params
    try {
        // Validate the account ID before querying MongoDB
        if (!mongoose.Types.ObjectId.isValid(accountId)) {
            return res.status(400).json({
                message: "Invalid account ID"
            })
        }

        // Find the account using account ID and user ID
        const account = await accountModel.findOne({
            _id: accountId,
            user: req.user._id
        })

        // If the account doesn't exist or doesn't belong to the user
        if (!account) {
            return res.status(404).json({
                message: "Account not found"
            })
        }

        // Calculate the account balance
        const balance = await account.getBalance()

        // Return the account ID and current balance
        res.status(200).json({
            accountId: account._id,
            balance: balance
        })
    }
    catch (err) {
        console.error("Get account balance error:", err)

        // Return a server error response
        return res.status(500).json({
            message: "Internal server error"
        })
    }
}

module.exports = { createAccountController, getUserAccountsController, getAccountBalanceController }