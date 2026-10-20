const express = require("express")
const authMiddleware = require("../middlewares/auth.middleware.js")
const accountController = require("../controllers/account.controller.js")

const router = express.Router()

// Create a new account for the authenticated user
// POST /api/accounts/
router.post("/", authMiddleware.authMiddleware, accountController.createAccountController)

// Get all accounts belonging to the authenticated user
// GET /api/accounts/
router.get("/", authMiddleware.authMiddleware, accountController.getUserAccountsController)

// Get the balance of a specific account using its account ID
// GET /api/accounts/balance/:accountId
router.get("/balance/:accountId", authMiddleware.authMiddleware, accountController.getAccountBalanceController)

module.exports = router