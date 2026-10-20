const express = require("express")
const authController = require("../controllers/auth.controller.js")

const router = express.Router()

// Register a new user
// POST /api/auth/register
router.post("/register", authController.userRegisterController)

// Login an existing user
// POST /api/auth/login
router.post("/login", authController.userLoginController)

// Logout the currently logged-in user
// POST /api/auth/logout
router.post("/logout", authController.userLogoutController)

module.exports = router