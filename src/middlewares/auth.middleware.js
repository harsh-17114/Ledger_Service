const userModel = require("../models/user.model.js")
const tokenBlackListModel = require("../models/blackList.model.js")
const jwt = require("jsonwebtoken")

// Authenticate normal user
async function authMiddleware(req, res, next) {
    const token = req.cookies?.token || req.headers.authorization?.split(" ")[1]

    // Reject the request if the token is missing
    if (!token) {
        return res.status(401).json({
            message: "Unauthorized access, token is missing"
        })
    }

    try {
        // Check whether the token has been blacklisted
        const isBlacklisted = await tokenBlackListModel.findOne({ token })

        // Reject the request if the token has been blacklisted
        if (isBlacklisted) {
            return res.status(401).json({
                message: "Unauthorized access, token is invalid"
            })
        }

        // Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        const user = await userModel.findById(decoded.userId)

        // If no user is found, return an authentication error
        if (!user) {
            return res.status(401).json({
                message: "Unauthorized access, user not found"
            })
        }

        req.user = user
        return next()
    }
    catch (err) {
        console.error("Authentication error:", err)

        // Return an unauthorized error response
        return res.status(401).json({
            message: "Unauthorized access, token is invalid"
        })
    }
}

// Authenticate system user
async function authSystemUserMiddleware(req, res, next) {
    const token = req.cookies?.token || req.headers.authorization?.split(" ")[1]

    // Reject the request if the token is missing
    if (!token) {
        return res.status(401).json({
            message: "Unauthorized access, token is missing"
        })
    }

    try {
        // Check whether the token has been blacklisted
        const isBlacklisted = await tokenBlackListModel.findOne({ token })

        // Reject the request if the token has been blacklisted
        if (isBlacklisted) {
            return res.status(401).json({
                message: "Unauthorized access, token is invalid"
            })
        }

        // Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        const user = await userModel.findById(decoded.userId).select("+systemUser")

        // If no user is found, return an authentication error
        if (!user) {
            return res.status(401).json({
                message: "Unauthorized access, user not found"
            })
        }

        // If no system user is found, return a forbidden error
        if (!user.systemUser) {
            return res.status(403).json({
                message: "Forbidden access, not a system user"
            })
        }

        req.user = user
        return next()
    }
    catch (err) {
        console.error("Authentication error:", err)

        // Return an unauthorized error response
        return res.status(401).json({
            message: "Unauthorized access, token is invalid"
        })
    }

}

module.exports = { authMiddleware, authSystemUserMiddleware }