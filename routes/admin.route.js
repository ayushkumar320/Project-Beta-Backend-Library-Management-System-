import express from 'express';
import adminAuth from '../middlewares/admin.auth.js';

const router = express.Router();


router.get('/login', adminAuth, (req, res) => {
 
  res.status(200).json({ message: 'Admin logged in successfully' });
});



export default router;
