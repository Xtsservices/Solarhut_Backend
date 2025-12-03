// Test script to debug permission update
import { Request, Response } from 'express';
import * as permissionQueries from './src/queries/permissionQueries';
import * as roleQueries from './src/queries/roleQueries';
import * as featureQueries from './src/queries/featureQueries';

const testUpdatePermission = async () => {
    try {
        console.log('Testing permission update...');
        
        // Test if queries work
        console.log('Testing getPermissionById...');
        const permission = await permissionQueries.getPermissionById(1);
        console.log('Permission result:', permission);
        
        if (permission) {
            console.log('Testing getRoleById...');
            const role = await roleQueries.getRoleById(permission.role_id);
            console.log('Role result:', role);
            
            console.log('Testing getFeatureById...');  
            const feature = await featureQueries.getFeatureById(permission.feature_id);
            console.log('Feature result:', feature);
            
            console.log('Testing createRoleFeaturePermissions...');
            const insertedIds = await permissionQueries.createRoleFeaturePermissions(
                permission.role_id,
                permission.feature_id,
                ['create'],
                1
            );
            console.log('Inserted IDs:', insertedIds);
        }
        
    } catch (error) {
        console.error('Test error:', error);
    }
};

// Run test
testUpdatePermission();