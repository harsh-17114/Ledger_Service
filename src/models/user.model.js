const mongoose = require("mongoose")
const bcrypt = require("bcryptjs")

// Define user schema
const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: [true, "Email is required for creating a user"],
        trim: true,
        lowercase: true,
        match: [/^\S+@\S+\.\S+$/, "Invalid Email Address"],
        unique: [true, "Email Already Exist"]
    },
    name: {
        type: String,
        required: [true, "Name is required for creating an account"],
        trim: true
    },
    password: {
        type: String,
        required: [true, "Password is required for creating an account"],
        minLength: [6, "Password should contain at least 6 characters"],
        select: false
    },
    systemUser: {
        type: Boolean,
        default: false,
        immutable: true,
        select: false
    }
}, {
    timestamps: true
})

// Hash the user's password before saving it to the database
userSchema.pre("save", async function () {
    // If the password has not been changed, don't hash it again
    if (!this.isModified("password")) {
        return
    }

    // Generate a secure hash of the password
    const hash = await bcrypt.hash(this.password, 10)
    this.password = hash

    return
})

// Method to compare a plain-text password with the stored hashed password
userSchema.methods.comparePassword = async function (password) {
    return await bcrypt.compare(password, this.password)
}

// Create user model
const userModel = mongoose.model("user", userSchema)

module.exports = userModel