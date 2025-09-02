import jwt from 'jsonwebtoken';
import Admin from '../models/admin.model.js';

const adminAuth = async (req, res, next) => {
    try {
        const token = req.header('Authorization').replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ message: 'Authentication token is missing' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'JWT_SECRET');
        const admin = await Admin.findOne({ _id: decoded._id });

        if (!admin) {
            return res.status(401).json({ message: 'Admin not found' });
        }

        req.token = token;
        req.admin = admin;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Please authenticate' });
    }
};

export default adminAuth;