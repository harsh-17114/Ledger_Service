const mongoose = require("mongoose")
const transactionModel = require("../models/transaction.model.js")
const ledgerModel = require("../models/ledger.model.js")
const accountModel = require("../models/account.model.js")
const emailService = require("../services/email.service.js")

async function createTransactionController(req, res) {
    const { fromAccount, toAccount, amount, idempotencyKey } = req.body
    let session
    try {
        // Check whether all required fields are provided
        if (!fromAccount || !toAccount || !idempotencyKey) {
            return res.status(400).json({
                message: "FromAccount, toAccount, amount and idempotencyKey are required"
            })
        }

        // Check whether account IDs are valid MongoDB ObjectIds
        if (!mongoose.Types.ObjectId.isValid(fromAccount) || !mongoose.Types.ObjectId.isValid(toAccount)) {
            return res.status(400).json({
                message: "Invalid fromAccount or toAccount"
            })
        }

        // Check whether amount is a valid positive number
        if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
            return res.status(400).json({
                message: "Transaction amount must be a valid number greater than 0"
            })
        }

        // Prevent transferring money from an account to itself
        if (fromAccount === toAccount) {
            return res.status(400).json({
                message: "FromAccount and toAccount cannot be the same"
            })
        }

        // Check whether a transaction with this idempotency key has already been created
        const isTransactionAlreadyExists = await transactionModel.findOne({ idempotencyKey: idempotencyKey })

        // Handle an already existing transaction
        if (isTransactionAlreadyExists) {
            // Make sure the same idempotency key is not reused
            if (isTransactionAlreadyExists.fromAccount.toString() !== fromAccount || isTransactionAlreadyExists.toAccount.toString() !== toAccount || isTransactionAlreadyExists.amount !== amount) {
                return res.status(409).json({
                    message: "Idempotency key has already been used for a different transaction"
                })
            }

            // If the transaction was already completed
            if (isTransactionAlreadyExists.status === "COMPLETED") {
                return res.status(200).json({
                    message: "Transaction already processed",
                    transaction: isTransactionAlreadyExists
                })
            }

            // If the transaction was still pending
            if (isTransactionAlreadyExists.status === "PENDING") {
                return res.status(202).json({
                    message: "Transaction is still processing",
                })
            }

            // If the transaction failed or was reversed
            return res.status(409).json({
                message: "Transaction cannot be retried with this idempotency key"
            })
        }

        // Find the sender's account
        const fromUserAccount = await accountModel.findOne({
            _id: fromAccount,
            user: req.user._id
        })

        // Find the receiver's account
        const toUserAccount = await accountModel.findOne({ _id: toAccount })

        // Make sure both accounts exist
        if (!fromUserAccount || !toUserAccount) {
            return res.status(400).json({
                message: "Invalid fromAccount or toAccount"
            })
        }

        // Both accounts must be active before processing the transaction
        if (fromUserAccount.status !== "ACTIVE" || toUserAccount.status !== "ACTIVE") {
            return res.status(400).json({
                message: "Both fromAccount and toAccount must be ACTIVE to process transaction"
            })
        }

        // Start a MongoDB session
        session = await mongoose.startSession()

        // Start a database transaction
        session.startTransaction()

        // Atomically deduct the amount from the sender's balance
        const updatedSenderAccount = await accountModel.findOneAndUpdate({
            _id: fromAccount,
            user: req.user._id,
            status: "ACTIVE",
            balance: { $gte: amount }
        }, {
            $inc: { balance: -amount }
        }, {
            session,
            new: true
        })

        // Reject the transaction if the sender does not have enough balance
        if (!updatedSenderAccount) {
            await session.abortTransaction()

            return res.status(400).json({
                message: "Insufficient balance"
            })
        }

        // Create the transaction record with PENDING status
        const transaction = (await transactionModel.create([{
            fromAccount,
            toAccount,
            amount,
            idempotencyKey,
            status: "PENDING"
        }], { session }))[0]

        // Create a DEBIT ledger entry for the sender
        await ledgerModel.create([{
            account: fromAccount,
            amount: amount,
            transaction: transaction._id,
            type: "DEBIT"
        }], { session })

        // Add the transaction amount to the receiver's balance
        const updatedReceiverAccount = await accountModel.findOneAndUpdate({
            _id: toAccount,
            status: "ACTIVE"
        }, {
            $inc: { balance: amount }
        }, {
            session
        })

        // Reject the transaction if the receiver account could not be updated
        if (!updatedReceiverAccount) {
            throw new Error("Receiver account could not be updated")
        }

        // Create a CREDIT ledger entry for the receiver
        await ledgerModel.create([{
            account: toAccount,
            amount: amount,
            transaction: transaction._id,
            type: "CREDIT"
        }], { session })

        // / Update the transaction status from PENDING to COMPLETED
        const completedTransaction = await transactionModel.findOneAndUpdate(
            { _id: transaction._id },
            { status: "COMPLETED" },
            {
                session,
                new: true
            }
        )

        // Commit all changes made during the transaction
        await session.commitTransaction()

        try {
            // Send a transaction-success email to the sender
            await emailService.sendTransactionEmail(req.user.email, req.user.name, amount, toAccount)
        }
        catch (err) {
            console.error("Transaction email error:", err)
        }

        // Return a successful transaction response
        return res.status(201).json({
            message: "Transaction completed successfully",
            transaction: completedTransaction
        })
    }
    catch (error) {
        console.error("Transaction Error:", error)

        // If a MongoDB session exists, abort the transaction
        if (session?.inTransaction()) {
            await session.abortTransaction()
        }

        // Handle duplicate idempotency key
        if (error.code === 11000) {
            const existingTransaction = await transactionModel.findOne({
                idempotencyKey
            })

            // If the transaction was already completed
            if (existingTransaction) {
                return res.status(200).json({
                    message: "Transaction already processed",
                    transaction: existingTransaction
                })
            }
        }

        // Return an error response to the client
        return res.status(500).json({
            message: "Transaction failed, please try again later"
        })
    }
    finally {
        // If a MongoDB session exists, end the transaction
        if (session) {
            // End the MongoDB session
            await session.endSession()
        }
    }
}

async function createInitialFundsTransactionController(req, res) {
    const { toAccount, amount, idempotencyKey } = req.body
    let session
    try {
        // Check whether all required fields are provided
        if (!toAccount || !idempotencyKey) {
            return res.status(400).json({
                message: "toAccount, amount and idempotencyKey are required"
            })
        }

        // Check whether amount is a valid positive number
        if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
            return res.status(400).json({
                message: "Transaction amount must be a valid number greater than 0"
            })
        }

        // Check whether a transaction with this idempotency key has already been created
        const isTransactionAlreadyExists = await transactionModel.findOne({ idempotencyKey })

        // Handle an already existing transaction
        if (isTransactionAlreadyExists) {
            // Make sure the same idempotency key is not reused
            if (isTransactionAlreadyExists.toAccount.toString() !== toAccount || isTransactionAlreadyExists.amount !== amount) {
                return res.status(409).json({
                    message: "Idempotency key has already been used for a different transaction"
                })
            }

            // If the transaction was already completed
            if (isTransactionAlreadyExists.status === "COMPLETED") {
                return res.status(200).json({
                    message: "Transaction already processed",
                    transaction: isTransactionAlreadyExists
                })
            }

            // If the transaction was still pending
            if (isTransactionAlreadyExists.status === "PENDING") {
                return res.status(202).json({
                    message: "Transaction is still processing",
                })
            }

            // If the transaction failed or was reversed
            return res.status(409).json({
                message: "Transaction cannot be retried with this idempotency key"
            })
        }

        // Validate the destination account ID
        if (!mongoose.Types.ObjectId.isValid(toAccount)) {
            return res.status(400).json({
                message: "Invalid account ID"
            })
        }

        // Find the receiver's account
        const toUserAccount = await accountModel.findOne({ _id: toAccount })

        // Make sure the receiver's  account exists
        if (!toUserAccount) {
            return res.status(400).json({
                message: "Invalid toAccount"
            })
        }

        // Receiver accounts must be active before processing the transaction
        if (toUserAccount.status !== "ACTIVE") {
            return res.status(400).json({
                message: "Destination account must be ACTIVE"
            })
        }

        // Find the sender's account
        const fromUserAccount = await accountModel.findOne({ user: req.user._id })

        // Make sure the sender's  account exists
        if (!fromUserAccount) {
            return res.status(400).json({
                message: "System user account not found"
            })
        }

        // Prevent transferring initial funds to the system account itself
        if (fromUserAccount._id.toString() === toAccount) {
            return res.status(400).json({
                message: "System account cannot be the destination account"
            })
        }

        // Sender accounts must be active before processing the transaction
        if (fromUserAccount.status !== "ACTIVE") {
            return res.status(400).json({
                message: "System account must be ACTIVE"
            })
        }

        // Start a MongoDB session
        session = await mongoose.startSession()

        // Start a database transaction
        session.startTransaction()

        // Atomically deduct the amount from the system account
        const updatedSystemAccount = await accountModel.findOneAndUpdate({
            _id: fromUserAccount._id,
            status: "ACTIVE",
            balance: { $gte: amount }
        }, {
            $inc: { balance: -amount }
        }, {
            session,
            new: true
        })

        // Reject the transaction if the system account does not have enough balance
        if (!updatedSystemAccount) {
            await session.abortTransaction()

            return res.status(400).json({
                message: "Insufficient system account balance"
            })
        }

        // Create the transaction record with PENDING status
        const transaction = new transactionModel({
            fromAccount: fromUserAccount._id,
            toAccount,
            amount,
            idempotencyKey,
            status: "PENDING"
        })

        // Create a DEBIT ledger entry for the sender
        await ledgerModel.create([{
            account: fromUserAccount._id,
            amount,
            transaction: transaction._id,
            type: "DEBIT"
        }], { session })

        // Add the transaction amount to the receiver's balance
        const updatedReceiverAccount = await accountModel.findOneAndUpdate({
            _id: toAccount,
            status: "ACTIVE"
        }, {
            $inc: { balance: amount }
        }, {
            session
        })

        // Reject the transaction if the receiver account could not be updated
        if (!updatedReceiverAccount) {
            throw new Error("Receiver account could not be updated")
        }

        // Create a CREDIT ledger entry for the receiver
        await ledgerModel.create([{
            account: toAccount,
            amount,
            transaction: transaction._id,
            type: "CREDIT"
        }], { session })

        // Update the transaction status from PENDING to COMPLETED
        transaction.status = "COMPLETED"

        // Save the transaction inside the current MongoDB session
        await transaction.save({ session })

        // Commit all changes made during the transaction
        await session.commitTransaction()

        // Return a successful transaction response
        return res.status(201).json({
            message: "Initial funds transaction completed successfully",
            transaction
        })

    }
    catch (error) {
        console.error("Initial Funds Transaction Error:", error)

        // If a MongoDB session exists, abort the transaction
        if (session?.inTransaction()) {
            await session.abortTransaction()
        }

        // Handle duplicate idempotency key
        if (error.code === 11000) {
            const existingTransaction = await transactionModel.findOne({
                idempotencyKey
            })

            // If the transaction was already completed
            if (existingTransaction) {
                return res.status(200).json({
                    message: "Transaction already processed",
                    transaction: existingTransaction
                })
            }
        }

        // Return an error response to the client
        return res.status(500).json({
            message:
                "Initial funds transaction failed, please try again later"
        })
    }
    finally {
        // If a MongoDB session exists, end the transaction
        if (session) {
            // End the MongoDB session
            await session.endSession()
        }
    }
}

module.exports = { createTransactionController, createInitialFundsTransactionController }