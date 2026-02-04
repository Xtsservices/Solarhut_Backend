import express from "express";
import * as solarCapacityController from "../controllers/solarCapacityController";
import { authenticate, authorizeRoles } from "../middleware/auth";
import { validateRequest } from "../middleware/validateRequest";
import {
  createSolarCapacitySchema,
  updateSolarCapacitySchema,
  deleteSolarCapacitySchema,
  idParamSchema,
  categoryParamSchema
} from "../utils/solarCapacityValidations";

const router = express.Router();

// Create reusable middleware
const requireSuperAdmin = authorizeRoles(['SuperAdmin']);

// ===== SIMPLIFIED UNIFIED ROUTES =====

// Get available category types for dropdown
router.get(
  "/categories",
  authenticate,
  solarCapacityController.getCategoryTypes
);

// Get items by category type (for requirement form dropdowns)
router.get(
  "/:categoryType/items",
  authenticate,
  solarCapacityController.getItemsByCategory
);

// Add new item to any category (SuperAdmin only) - Unified endpoint
router.post(
  "/items",
  authenticate,
  requireSuperAdmin,
  validateRequest(createSolarCapacitySchema),
  solarCapacityController.addItem
);

// Update item in any category (SuperAdmin only) - Unified endpoint
router.put(
  "/items/:id",
  authenticate,
  requireSuperAdmin,
  validateRequest(updateSolarCapacitySchema),
  solarCapacityController.updateItem
);

// Delete item from any category (SuperAdmin only) - Unified endpoint
router.delete(
  "/items/:id",
  authenticate,
  requireSuperAdmin,
  solarCapacityController.deleteItem
);

// Add new item to any category (SuperAdmin only) - Legacy endpoint
router.post(
  "/:categoryType/items",
  authenticate,
  requireSuperAdmin,
  validateRequest(createSolarCapacitySchema),
  solarCapacityController.addItemToCategory
);

// Get all items from all categories (for admin management)
router.get(
  "/admin/all-items",
  authenticate,
  requireSuperAdmin,
  solarCapacityController.getAllCategoryItems
);

// Update item in any category (SuperAdmin only)
router.put(
  "/:categoryType/items/:id",
  authenticate,
  requireSuperAdmin,
  validateRequest(updateSolarCapacitySchema),
  solarCapacityController.updateCategoryItem
);

// Delete item from any category (SuperAdmin only)
router.delete(
  "/:categoryType/items/:id",
  authenticate,
  requireSuperAdmin,
  solarCapacityController.deleteCategoryItem
);

export default router;