import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/authUtils';

// Attach user payload to res.locals.user
export const authenticate = (req: Request, res: Response, next: NextFunction) => {
    console.log('🔍 AUTH DEBUG - Headers received:', req.headers);
    console.log('🔍 AUTH DEBUG - Authorization header:', req.headers.authorization);
    
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    
    console.log('🔍 AUTH DEBUG - Extracted token:', token ? token.substring(0, 20) + '...' : 'No token');
    
    if (!token) {
        console.log('❌ AUTH DEBUG - No token provided');
        return res.status(401).json({ success: false, message: 'Authorization token required' });
    }

    const payload = verifyToken(token);
    console.log('🔍 AUTH DEBUG - Token verification result:', payload ? 'SUCCESS' : 'FAILED');
    
    if (!payload) {
        console.log('❌ AUTH DEBUG - Invalid or expired token');
        return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }

    console.log('✅ AUTH DEBUG - User authenticated:', payload.user_id || payload.id);
    // store user on res.locals to keep typings simple
    (res.locals as any).user = payload;
    next();
};

export const authorizeRoles = (allowedRoles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = (res.locals as any).user;
        if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });
        
        console.log('Authorization check:');
        console.log('- User:', user);
        console.log('- User roles:', user.roles);
        console.log('- Required roles:', allowedRoles);
        console.log('- Is roles array?', Array.isArray(user.roles));

        const hasRole = Array.isArray(user.roles) && user.roles.some((r: string) => allowedRoles.includes(r));
        console.log('- Has required role?', hasRole);
        
        if (!hasRole) {
            return res.status(403).json({ 
                success: false, 
                message: 'Forbidden',
                debug: process.env.NODE_ENV === 'development' ? {
                    userRoles: user.roles,
                    requiredRoles: allowedRoles
                } : undefined
            });
        }

        next();
    };
};

export default { authenticate, authorizeRoles };
