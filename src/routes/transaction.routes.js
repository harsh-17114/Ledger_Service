const express = require('express')
const authMiddleware = require('../middlewares/auth.middleware.js')
const transactionController = require("../controllers/transaction.controller.js")

const router = express.Router()

// Create a new transaction
// Requires the user to be authenticated
// POST /api/transactions/
router.post("/", authMiddleware.authMiddleware, transactionController.createTransactionController)

// Create an initial funds transaction for the system
// Requires system user authentication
// POST /api/transactions/system/initial-funds
router.post("/system/initial-funds", authMiddleware.authSystemUserMiddleware, transactionController.createInitialFundsTransactionController)

module.exports = router