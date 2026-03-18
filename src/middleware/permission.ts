import { Request, Response, NextFunction } from 'express';
import * as permissionQueries from '../queries/permissionQueries';

// Middleware to check if user has specific permission for a feature
export const requirePermission = (featureName: string, permission: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (res.locals as any).user;
      
      if (!user || !user.id) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required. Please login to continue.',
          error_code: 'AUTHENTICATION_REQUIRED'
        });
      }

      // Get user's features with permissions
      const userFeatures = await permissionQueries.getEmployeePermissionsWithSubFeatures(user.id);
      
      // Check if user has the required feature and permission
      const feature = userFeatures.find(f => f.feature_name === featureName);
      
      if (!feature) {
        return res.status(403).json({
          success: false,
          message: `Access denied. You don't have permission to access ${featureName} module.`,
          error_code: 'FEATURE_ACCESS_DENIED',
          feature: featureName
        });
      }

      if (!feature.permissions.includes(permission)) {
        const actionNames: { [key: string]: string } = {
          'create': 'add new',
          'read': 'view', 
          'edit': 'modify',
          'delete': 'remove'
        };
        
        const actionName = actionNames[permission] || permission;
        
        return res.status(403).json({
          success: false,
          message: `Access denied. You don't have permission to ${actionName} ${featureName} records.`,
          error_code: 'PERMISSION_DENIED',
          required_permission: permission,
          user_permissions: feature.permissions.split(','),
          feature: featureName,
          suggested_action: `Contact your administrator to request '${permission}' permission for ${featureName}.`
        });
      }

      // Store user permissions in response locals for further use
      res.locals.userFeatures = userFeatures;
      res.locals.currentFeature = feature;
      
      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({
        success: false,
        message: 'Error checking permissions',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  };
};

// Helper middleware for common permission patterns
export const canCreate = (featureName: string) => requirePermission(featureName, 'create');
export const canRead = (featureName: string) => requirePermission(featureName, 'read');
export const canEdit = (featureName: string) => requirePermission(featureName, 'edit');
export const canDelete = (featureName: string) => requirePermission(featureName, 'delete');

// Middleware to check multiple permissions (user needs at least one)
export const requireAnyPermission = (featureName: string, permissions: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (res.locals as any).user;
      
      if (!user || !user.id) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required. Please login to continue.',
          error_code: 'AUTHENTICATION_REQUIRED'
        });
      }

      const userFeatures = await permissionQueries.getEmployeePermissionsWithSubFeatures(user.id);
      const feature = userFeatures.find(f => f.feature_name === featureName);
      
      if (!feature) {
        return res.status(403).json({
          success: false,
          message: `Access denied. You don't have permission to access ${featureName} module.`,
          error_code: 'FEATURE_ACCESS_DENIED',
          feature: featureName
        });
      }

      const hasRequiredPermission = permissions.some(perm => 
        feature.permissions.includes(perm)
      );

      if (!hasRequiredPermission) {
        const actionNames: { [key: string]: string } = {
          'create': 'add new',
          'read': 'view',
          'edit': 'modify', 
          'delete': 'remove'
        };
        
        const actionsList = permissions.map(p => actionNames[p] || p).join(', ');
        
        return res.status(403).json({
          success: false,
          message: `Access denied. You need one of these permissions: ${actionsList} for ${featureName}.`,
          error_code: 'PERMISSION_DENIED',
          required_permissions: permissions,
          user_permissions: feature.permissions.split(','),
          feature: featureName,
          suggested_action: `Contact your administrator to request one of these permissions: ${permissions.join(', ')} for ${featureName}.`
        });
      }

      res.locals.userFeatures = userFeatures;
      res.locals.currentFeature = feature;
      
      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({
        success: false,
        message: 'Error checking permissions',
        error: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  };
};