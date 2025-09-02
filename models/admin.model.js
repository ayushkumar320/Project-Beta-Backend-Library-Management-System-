import connectDB from "../db/connectDB"
import mongoose from "mongoose"

connectDB()


const AdminSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: true,
    },
})

const Admin = mongoose.model('Admin', AdminSchema)
module.exports = Admin