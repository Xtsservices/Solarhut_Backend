import { Request, Response } from 'express';
import * as featureQueries from '../queries/featureQueries';
import { featureSchema } from '../utils/validations';
import { allFeatures } from '../utils/common';

export const createFeature = async (req: Request, res: Response) => {
    try {
        const { error, value } = featureSchema.create.validate(req.body, { abortEarly: false });
        if (error) {
            return res.status(400).json({ 
                success: false, 
                message: 'Validation error', 
                errors: error.details.map(d => d.message) 
            });
        }

        // Get user ID from token payload
        const user = (res.locals as any).user;
        if (!user || !user.id) {
            return res.status(401).json({ success: false, message: 'User information not found' });
        }

        // Check if feature name already exists
        const existingFeature = await featureQueries.getFeatureByName(value.feature_name);
        if (existingFeature) {
            return res.status(400).json({ 
                success: false, 
                message: 'Feature name already exists. Please choose a different Feature name.' 
            });
        }

        const id = await featureQueries.createFeature(value.feature_name, user.id, value.status);
        const feature = await featureQueries.getFeatureById(id);

        res.status(201).json({ success: true, message: 'Feature created', data: feature });
    } catch (err) {
        console.error('Error creating feature:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Error creating feature', 
            error: process.env.NODE_ENV === 'development' ? err : undefined 
        });
    }
};

export const editFeature = async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        if (!id) return res.status(400).json({ success: false, message: 'Invalid feature id' });

        const { error, value } = featureSchema.update.validate(req.body, { abortEarly: false });
        if (error) {
            return res.status(400).json({ 
                success: false, 
                message: 'Validation error', 
                errors: error.details.map(d => d.message) 
            });
        }

        // Check if feature exists
        const existingFeature = await featureQueries.getFeatureById(id);
        if (!existingFeature) {
            return res.status(404).json({ success: false, message: 'Feature not found' });
        }

        // Check if new feature name already exists (only if name is being updated)
        if (value.feature_name && value.feature_name !== existingFeature.feature_name) {
            const duplicateFeature = await featureQueries.getFeatureByName(value.feature_name);
            if (duplicateFeature) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Feature name already exists. Please choose a different Feature name.' 
                });
            }
        }

        const updated = await featureQueries.updateFeature(id, value);
        if (!updated) {
            return res.status(400).json({ success: false, message: 'Failed to update feature or no changes provided' });
        }

        const feature = await featureQueries.getFeatureById(id);
        res.json({ success: true, message: 'Feature updated', data: feature });
    } catch (err) {
        console.error('Error updating feature:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Error updating feature', 
            error: process.env.NODE_ENV === 'development' ? err : undefined 
        });
    }
};

export const deleteFeature = async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        if (!id) return res.status(400).json({ success: false, message: 'Invalid feature id' });

        // Check if feature exists
        const existingFeature = await featureQueries.getFeatureById(id);
        if (!existingFeature) {
            return res.status(404).json({ success: false, message: 'Feature not found' });
        }

        const deactivated = await featureQueries.deactivateFeature(id);
        if (!deactivated) {
            return res.status(400).json({ success: false, message: 'Failed to deactivate feature' });
        }

        const feature = await featureQueries.getFeatureById(id);
        res.json({ success: true, message: 'Feature deactivated', data: feature });
    } catch (err) {
        console.error('Error deleting feature:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Error deleting feature', 
            error: process.env.NODE_ENV === 'development' ? err : undefined 
        });
    }
};

export const getFeature = async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        if (!id) return res.status(400).json({ success: false, message: 'Invalid feature id' });

        const feature = await featureQueries.getFeatureById(id);
        if (!feature) return res.status(404).json({ success: false, message: 'Feature not found' });

        res.json({ success: true, data: feature });
    } catch (err) {
        console.error('Error fetching feature:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching feature', 
            error: process.env.NODE_ENV === 'development' ? err : undefined 
        });
    }
};

export const listFeatures = async (req: Request, res: Response) => {
    try {
        const onlyActive = req.query.active === 'true';
        const features = await featureQueries.getAllFeatures(onlyActive);
        res.json({ success: true, data: features });
    } catch (err) {
        console.error('Error listing features:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Error listing features', 
            error: process.env.NODE_ENV === 'development' ? err : undefined 
        });
    }
};

export const listMyFeatures = async (req: Request, res: Response) => {
    try {
        const user = (res.locals as any).user;
        if (!user || !user.id) {
            return res.status(401).json({ success: false, message: 'User information not found' });
        }

        const onlyActive = req.query.active === 'true';
        const features = await featureQueries.getFeaturesByUser(user.id, onlyActive);
        res.json({ success: true, data: features });
    } catch (err) {
        console.error('Error listing user features:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Error listing user features', 
            error: process.env.NODE_ENV === 'development' ? err : undefined 
        });
    }
};

export const allfeatures = async (req: Request, res: Response) => {
    try {
        const features = allFeatures;   
        res.json({ success: true, data: features });
    }
    catch (err) {
        console.error('Error fetching all features:', err);
        res.status(500).json({
            success: false,
            message: 'Error fetching all features',
            error: process.env.NODE_ENV === 'development' ? err : undefined
        });
    }
};

export default { createFeature,allfeatures, editFeature, deleteFeature, getFeature, listFeatures, listMyFeatures };