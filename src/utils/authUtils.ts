import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Employee } from '../queries/employeeQueries';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export const hashPassword = async (password: string): Promise<string> => {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
};

export const comparePassword = async (password: string, hashedPassword: string): Promise<boolean> => {
    return bcrypt.compare(password, hashedPassword);
};

export const generateToken = (employee: Employee): string => {
    return jwt.sign(
        { 
            id: employee.id,
            email: employee.email,
            role_id: employee.role_id
        },
        JWT_SECRET,
        { expiresIn: '24h' }
    );
};

export const verifyToken = (token: string) => {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
};