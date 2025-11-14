import { Request, Response } from 'express';
import * as packageQueries from '../queries/packageQueries';
import { packageSchema } from '../utils/validations';

export const createPackage = async (req: Request, res: Response) => {
    try {
        const { error, value } = packageSchema.create.validate(req.body, { abortEarly: false });
        if (error) {
            return res.status(400).json({ success: false, message: 'Validation error', errors: error.details.map(d => d.message) });
        }

        const id = await packageQueries.createPackage(value as any);
        const pkg = await packageQueries.getPackageById(id);

        res.status(201).json({ success: true, message: 'Package created', data: pkg });
    } catch (err) {
        console.error('Error creating package:', err);
        res.status(500).json({ success: false, message: 'Error creating package', error: process.env.NODE_ENV === 'development' ? err : undefined });
    }
};

export const editPackage = async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        if (!id) return res.status(400).json({ success: false, message: 'Invalid package id' });

        const { error, value } = packageSchema.update.validate(req.body, { abortEarly: false });
        if (error) {
            return res.status(400).json({ success: false, message: 'Validation error', errors: error.details.map(d => d.message) });
        }

        const updated = await packageQueries.updatePackage(id, value as any);
        if (!updated) return res.status(400).json({ success: false, message: 'Failed to update package or no changes provided' });

        const pkg = await packageQueries.getPackageById(id);
        res.json({ success: true, message: 'Package updated', data: pkg });
    } catch (err) {
        console.error('Error updating package:', err);
        res.status(500).json({ success: false, message: 'Error updating package', error: process.env.NODE_ENV === 'development' ? err : undefined });
    }
};

export const deletePackage = async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        if (!id) return res.status(400).json({ success: false, message: 'Invalid package id' });

        const deactivated = await packageQueries.deactivatePackage(id);
        if (!deactivated) return res.status(400).json({ success: false, message: 'Failed to deactivate package' });

        const pkg = await packageQueries.getPackageById(id);
        res.json({ success: true, message: 'Package deactivated', data: pkg });
    } catch (err) {
        console.error('Error deleting package:', err);
        res.status(500).json({ success: false, message: 'Error deleting package', error: process.env.NODE_ENV === 'development' ? err : undefined });
    }
};

export const getPackage = async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        if (!id) return res.status(400).json({ success: false, message: 'Invalid package id' });

        const pkg = await packageQueries.getPackageById(id);
        if (!pkg) return res.status(404).json({ success: false, message: 'Package not found' });

        res.json({ success: true, data: pkg });
    } catch (err) {
        console.error('Error fetching package:', err);
        res.status(500).json({ success: false, message: 'Error fetching package', error: process.env.NODE_ENV === 'development' ? err : undefined });
    }
};

export const listPackages = async (req: Request, res: Response) => {
    try {
        const onlyActive = req.query.active === 'true';
        const pkgs = await packageQueries.getAllPackages(onlyActive);
        res.json({ success: true, data: pkgs });
    } catch (err) {
        console.error('Error listing packages:', err);
        res.status(500).json({ success: false, message: 'Error listing packages', error: process.env.NODE_ENV === 'development' ? err : undefined });
    }
};

export default { createPackage, editPackage, deletePackage, getPackage, listPackages };
