require("dotenv").config()
const app = require("./src/app.js")
const connectDB = require("./src/config/database.js")

async function startServer() {
    try {
        // Connect to database
        await connectDB()

        // Start app
        app.listen(3000, () => {
            console.log("Server Started Successfully")
        })
    }
    catch (err) {
        console.error("Server startup error:", err)

        // Exit the process 
        process.exit(1)
    }
}

startServer()