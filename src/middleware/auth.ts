import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/authUtils';

// Attach user payload to res.locals.user
export const authenticate = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    if (!token) {
        return res.status(401).json({ success: false, message: 'Authorization token required' });
    }

    const payload = verifyToken(token);
    if (!payload) {
        return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }

    // store user on res.locals to keep typings simple
    (res.locals as any).user = payload;
    next();
};

export const authorizeRoles = (allowedRoles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = (res.locals as any).user;
        if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });
        console.log('User roles:', user);

        const hasRole = Array.isArray(user.roles) && user.roles.some((r: string) => allowedRoles.includes(r));
        if (!hasRole) {
            return res.status(403).json({ success: false, message: 'Forbidden' });
        }

        next();
    };
};

export default { authenticate, authorizeRoles };
