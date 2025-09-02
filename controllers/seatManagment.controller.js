import mongoose from "mongoose";
import SeatManegment from "../models/seatManegment.model.js";
export async function SeatManegment(req, res) {
    try {
        const {seatNumber, student, plan, allocationDate, expirationDate, status} = req.body;
        const newSeatManegment = new SeatManegment({
            seatNumber,
            student,
            plan,
            allocationDate,
            expirationDate,
            status
        });
        await newSeatManegment.save();
        res.json({
            message: "New SeatManegment added!",
            seatNumber: seatNumber
        });

    }
    catch(error){
    console.log("Error creating in SeatManegment");
    res.status(500).json({
      message: "Internal server error"
    })
}}