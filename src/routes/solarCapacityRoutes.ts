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
// const requireSuperAdmin = authorizeRoles(['SuperAdmin']);

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
  validateRequest(createSolarCapacitySchema),
  solarCapacityController.addItem
);

// Update item in any category (SuperAdmin only) - Unified endpoint
router.put(
  "/items/:id",
  authenticate,
  validateRequest(updateSolarCapacitySchema),
  solarCapacityController.updateItem
);

// Delete item from any category (SuperAdmin only) - Unified endpoint
router.delete(
  "/items/:id",
  authenticate,
  solarCapacityController.deleteItem
);

// Add new item to any category (SuperAdmin only) - Legacy endpoint
router.post(
  "/:categoryType/items",
  authenticate,
  validateRequest(createSolarCapacitySchema),
  solarCapacityController.addItemToCategory
);

// Get all items from all categories (for admin management)
router.get(
  "/admin/all-items",
  authenticate,
  solarCapacityController.getAllCategoryItems
);

export default router;