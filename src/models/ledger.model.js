const mongoose = require('mongoose')

// Define ledger schema
const ledgerSchema = new mongoose.Schema({
    account: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "account",
        required: [true, "Ledger must be associated with an account"],
        index: true,
        immutable: true
    },
    amount: {
        type: Number,
        required: [true, "Amount is required for creating a ledger entry"],
        min: [0.01, "Ledger amount must be greater than 0"],
        immutable: true
    },
    transaction: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "transaction",
        required: [true, "Ledger must be associated with a transaction"],
        index: true,
        immutable: true
    },
    type: {
        type: String,
        enum: {
            values: ["CREDIT", "DEBIT"],
            message: "Type can be either CREDIT or DEBIT",
        },
        required: [true, "Ledger type is required"],
        immutable: true
    }
})

// Function used to prevent modification or deletion of ledger entries
function preventLedgerModification() {
    throw new Error("Ledger entries are immutable and cannot be modified or deleted")
}

// Prevent updating a single ledger entry
ledgerSchema.pre('findOneAndUpdate', preventLedgerModification)

// Prevent updating a ledger entry
ledgerSchema.pre('updateOne', preventLedgerModification)

// Prevent deleting a single ledger entry
ledgerSchema.pre('deleteOne', preventLedgerModification)

// Prevent removing a ledger entry
ledgerSchema.pre('remove', preventLedgerModification)

// Prevent deleting multiple ledger entries
ledgerSchema.pre('deleteMany', preventLedgerModification)

// Prevent updating multiple ledger entries
ledgerSchema.pre('updateMany', preventLedgerModification)

// Prevent finding and deleting a ledger entry
ledgerSchema.pre("findOneAndDelete", preventLedgerModification)

// Prevent replacing a ledger entry
ledgerSchema.pre("findOneAndReplace", preventLedgerModification)

// Prevent deleting a ledger entry
ledgerSchema.pre("findOneAndRemove", preventLedgerModification)

// Create ledger model
const ledgerModel = mongoose.model('ledger', ledgerSchema)

module.exports = ledgerModel