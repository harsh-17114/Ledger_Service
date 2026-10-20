const userModel = require("../models/user.model.js")
const tokenBlackListModel = require("../models/blackList.model.js")
const jwt = require("jsonwebtoken")
const emailService = require("../services/email.service.js")

// Register a new user
async function userRegisterController(req, res) {
    const { email, password, name } = req.body
    try {
        // Validate required fields
        if (!email || !password || !name) {
            return res.status(400).json({
                message: "Email, password and name are required"
            })
        }

        // Check if user already exists
        const isUserAlreadyExists = await userModel.findOne({ email: email })

        // If the email is already registered, return an error
        if (isUserAlreadyExists) {
            return res.status(422).json({
                message: "User already exists with this email",
                status: "failed"
            })
        }

        // Create new user
        const user = await userModel.create({
            email,
            password,
            name
        })

        // Generate JWT token
        const token = jwt.sign({
            userId: user._id
        }, process.env.JWT_SECRET, {
            expiresIn: "3d"
        })

        // Store the token in cookie
        res.cookie("token", token, {
            httpOnly: true,
            sameSite: "strict",
            secure: process.env.NODE_ENV === "production",
            maxAge: 3 * 24 * 60 * 60 * 1000
        })

        // Send registration email
        try {
            await emailService.sendRegistrationEmail(user.email, user.name)
        }
        catch (err) {
            console.error("Registration email error:", err)
        }

        // Send successful registration response
        res.status(201).json({
            user: {
                message: "User registered successfully",
                _id: user._id,
                email: user.email,
                name: user.name
            }
        })
    }
    catch (err) {
        console.error("Registration error:", err)

        // Handle duplicate email race condition
        if (err.code === 11000) {
            return res.status(409).json({
                message: "User already exists with this email"
            })
        }

        // Return a server error response
        return res.status(500).json({
            message: "Internal server error"
        })
    }
}

// Login an existing user
async function userLoginController(req, res) {
    const { email, password } = req.body
    try {
        // Validate required fields
        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required"
            })
        }

        // Find user by email
        const user = await userModel.findOne({ email: email }).select("+password")

        // If no user is found, return an authentication error
        if (!user) {
            return res.status(401).json({
                message: "Email or password is invalid"
            })
        }

        // Compare the entered password
        const isValidPassword = await user.comparePassword(password)

        // If the password is incorrect, return an authentication error
        if (!isValidPassword) {
            return res.status(401).json({
                message: "Email or password is invalid"
            })
        }

        // Generate JWT token
        const token = jwt.sign({
            userId: user._id
        }, process.env.JWT_SECRET, {
            expiresIn: "3d"
        })

        // Store the token in cookie
        res.cookie("token", token, {
            httpOnly: true,
            sameSite: "strict",
            secure: process.env.NODE_ENV === "production",
            maxAge: 3 * 24 * 60 * 60 * 1000
        })

        // Send successful login response
        res.status(200).json({
            user: {
                message: "User logged in successfully",
                _id: user._id,
                email: user.email,
                name: user.name
            }
        })
    }
    catch (err) {
        console.error("Login error:", err)

        // Return a server error response
        return res.status(500).json({
            message: "Internal server error"
        })
    }
}

// Logout the current user
async function userLogoutController(req, res) {
    const token = req.cookies?.token || req.headers.authorization?.split(" ")[1]

    // If no token exists, the user is already logged out
    if (!token) {
        return res.status(200).json({
            message: "User logged out successfully"
        })
    }

    try {
        // Add the token to the blacklist
        await tokenBlackListModel.create({ token: token })

        // Clear the authentication token cookie
        res.clearCookie("token", {
            httpOnly: true,
            sameSite: "strict",
            secure: process.env.NODE_ENV === "production"
        })

        // Send successful logout response
        res.status(200).json({
            message: "User logged out successfully"
        })
    }
    catch (err) {
        console.error("Logout error:", err)

        // Handle duplicate blacklist token
        if (err.code === 11000) {
            res.clearCookie("token", {
                httpOnly: true,
                sameSite: "strict",
                secure: process.env.NODE_ENV === "production",
            })

            // Send successful logout response
            return res.status(200).json({
                message: "User logged out successfully"
            })
        }

        // Return a server error response
        return res.status(500).json({
            message: "Internal server error"
        })
    }
}

module.exports = { userRegisterController, userLoginController, userLogoutController }