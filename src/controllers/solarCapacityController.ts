import { Request, Response } from "express";
import * as inverterTypeQueries from "../queries/inverterTypeQueries";
import * as productDescriptionQueries from "../queries/productDescriptionQueries";
import * as structureQueries from "../queries/structureQueries";

// Get available category types
export const getCategoryTypes = async (req: Request, res: Response) => {
  try {
    const categoryTypes = [
      { value: 'inverter_types', table: 'inverter_types' },
      { value: 'product_descriptions', table: 'product_descriptions' },
      { value: 'structures', table: 'structures' }
    ];
    
    res.status(200).json({
      message: "Category types retrieved successfully",
      data: categoryTypes
    });
  } catch (error: any) {
    console.error("Error fetching category types:", error);
    res.status(500).json({
      message: "Error fetching category types",
      error: error.message
    });
  }
};

// Get items by category type (for dropdowns)
export const getItemsByCategory = async (req: Request, res: Response) => {
  try {
    const { categoryType } = req.params;
    let items = [];

    switch (categoryType) {
      case 'inverter_types':
        items = await inverterTypeQueries.getActiveInverterTypes();
        break;
      case 'product_descriptions':
        items = await productDescriptionQueries.getActiveProductDescriptions();
        break;
      case 'structures':
        items = await structureQueries.getActiveStructures();
        break;
      default:
        return res.status(400).json({
          message: "Invalid category type. Must be one of: inverter_types, product_descriptions, structures"
        });
    }

    res.status(200).json({
      message: `${categoryType} items retrieved successfully`,
      data: items
    });
  } catch (error: any) {
    console.error("Error fetching category items:", error);
    res.status(500).json({
      message: "Error fetching category items",
      error: error.message
    });
  }
};

// Add new item to any category - Unified endpoint
export const addItem = async (req: Request, res: Response) => {
  try {
    const { category, name } = req.body;
    const user = (res.locals as any).user;

    let itemId;
    let createdItem;

    switch (category) {
      case 'inverter_types':
        // Check if name already exists
        const inverterExists = await inverterTypeQueries.inverterTypeNameExists(name);
        if (inverterExists) {
          return res.status(400).json({
            message: "Inverter type with this name already exists"
          });
        }
        
        itemId = await inverterTypeQueries.createInverterType({
          name,
          created_by: user.id
        });
        
        // Fetch the complete created item
        createdItem = await inverterTypeQueries.getInverterTypeById(itemId);
        break;

      case 'product_descriptions':
        // Check if name already exists
        const productExists = await productDescriptionQueries.productDescriptionNameExists(name);
        if (productExists) {
          return res.status(400).json({
            message: "Product description with this name already exists"
          });
        }
        
        itemId = await productDescriptionQueries.createProductDescription({
          name,
          created_by: user.id
        });
        
        // Fetch the complete created item
        createdItem = await productDescriptionQueries.getProductDescriptionById(itemId);
        break;

      case 'structures':
        // Check if name already exists
        const structureExists = await structureQueries.structureNameExists(name);
        if (structureExists) {
          return res.status(400).json({
            message: "Structure with this name already exists"
          });
        }
        
        itemId = await structureQueries.createStructure({
          name,
          created_by: user.id
        });
        
        // Fetch the complete created item
        createdItem = await structureQueries.getStructureById(itemId);
        break;

      default:
        return res.status(400).json({
          message: "Invalid category. Must be one of: inverter_types, product_descriptions, structures"
        });
    }

    res.status(201).json({
      message: `Item added to ${category} successfully`,
      data: createdItem
    });
  } catch (error: any) {
    console.error("Error adding item:", error);
    res.status(500).json({
      message: "Error adding item",
      error: error.message
    });
  }
};

// Update item in any category - Unified endpoint
export const updateItem = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { category, name, status } = req.body;
    const user = (res.locals as any).user;

    const itemId = parseInt(id);
    let updatedItem;

    switch (category) {
      case 'inverter_types':
        // Check if new name already exists (excluding current item)
        if (name) {
          const inverterExists = await inverterTypeQueries.inverterTypeNameExists(name, itemId);
          if (inverterExists) {
            return res.status(400).json({
              message: "Inverter type with this name already exists"
            });
          }
        }
        
        const inverterUpdated = await inverterTypeQueries.updateInverterType(itemId, { name, status, updated_by: user.id });
        if (!inverterUpdated) {
          return res.status(404).json({
            message: "Inverter type not found"
          });
        }
        
        updatedItem = await inverterTypeQueries.getInverterTypeById(itemId);
        break;

      case 'product_descriptions':
        // Check if new name already exists (excluding current item)
        if (name) {
          const productExists = await productDescriptionQueries.productDescriptionNameExists(name, undefined, itemId);
          if (productExists) {
            return res.status(400).json({
              message: "Product description with this name already exists"
            });
          }
        }
        
        const productUpdated = await productDescriptionQueries.updateProductDescription(itemId, { name, status }, user.id);
        if (!productUpdated) {
          return res.status(404).json({
            message: "Product description not found"
          });
        }
        
        updatedItem = await productDescriptionQueries.getProductDescriptionById(itemId);
        break;

      case 'structures':
        // Check if new name already exists (excluding current item)
        if (name) {
          const structureExists = await structureQueries.structureNameExists(name, itemId);
          if (structureExists) {
            return res.status(400).json({
              message: "Structure with this name already exists"
            });
          }
        }
        
        const structureUpdated = await structureQueries.updateStructure(itemId, { name, status }, user.id);
        if (!structureUpdated) {
          return res.status(404).json({
            message: "Structure not found"
          });
        }
        
        updatedItem = await structureQueries.getStructureById(itemId);
        break;

      default:
        return res.status(400).json({
          message: "Invalid category. Must be one of: inverter_types, product_descriptions, structures"
        });
    }

    res.status(200).json({
      message: `Item updated in ${category} successfully`,
      data: updatedItem
    });
  } catch (error: any) {
    console.error("Error updating item:", error);
    res.status(500).json({
      message: "Error updating item",
      error: error.message
    });
  }
};

// Delete item from any category - Unified endpoint
export const deleteItem = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { category } = req.query;

    if (!category) {
      return res.status(400).json({
        message: "Category query parameter is required"
      });
    }

    const itemId = parseInt(id);
    let deleted = false;

    switch (category) {
      case 'inverter_types':
        deleted = await inverterTypeQueries.deleteInverterType(itemId);
        break;

      case 'product_descriptions':
        deleted = await productDescriptionQueries.deleteProductDescription(itemId);
        break;

      case 'structures':
        deleted = await structureQueries.deleteStructure(itemId);
        break;

      default:
        return res.status(400).json({
          message: "Invalid category. Must be one of: inverter_types, product_descriptions, structures"
        });
    }

    if (!deleted) {
      return res.status(404).json({
        message: `Item not found in ${category}`
      });
    }

    res.status(200).json({
      message: `Item deleted from ${category} successfully`
    });
  } catch (error: any) {
    console.error("Error deleting item:", error);
    res.status(500).json({
      message: "Error deleting item",
      error: error.message
    });
  }
};

// Add new item to any category - Legacy endpoint
export const addItemToCategory = async (req: Request, res: Response) => {
  try {
    const { categoryType } = req.params;
    const { name } = req.body;
    const user = (res.locals as any).user;

    let itemId;
    let createdItem;

    switch (categoryType) {
      case 'inverter_types':
        // Check if name already exists
        const inverterExists = await inverterTypeQueries.inverterTypeNameExists(name);
        if (inverterExists) {
          return res.status(400).json({
            message: "Inverter type with this name already exists"
          });
        }
        
        itemId = await inverterTypeQueries.createInverterType({
          name,
          created_by: user.id
        });
        
        // Fetch the complete created item
        createdItem = await inverterTypeQueries.getInverterTypeById(itemId);
        break;

      case 'product_descriptions':
        // Check if name already exists
        const productExists = await productDescriptionQueries.productDescriptionNameExists(name);
        if (productExists) {
          return res.status(400).json({
            message: "Product description with this name already exists"
          });
        }
        
        itemId = await productDescriptionQueries.createProductDescription({
          name,
          created_by: user.id
        });
        
        // Fetch the complete created item
        createdItem = await productDescriptionQueries.getProductDescriptionById(itemId);
        break;

      case 'structures':
        // Check if name already exists
        const structureExists = await structureQueries.structureNameExists(name);
        if (structureExists) {
          return res.status(400).json({
            message: "Structure with this name already exists"
          });
        }
        
        itemId = await structureQueries.createStructure({
          name,
          created_by: user.id
        });
        
        // Fetch the complete created item
        createdItem = await structureQueries.getStructureById(itemId);
        break;

      default:
        return res.status(400).json({
          message: "Invalid category type. Must be one of: inverter_types, product_descriptions, structures"
        });
    }

    res.status(201).json({
      message: `Item added to ${categoryType} successfully`,
      data: createdItem
    });
  } catch (error: any) {
    console.error("Error adding item to category:", error);
    res.status(500).json({
      message: "Error adding item to category",
      error: error.message
    });
  }
};

// Get all items from all categories (for admin management)
export const getAllCategoryItems = async (req: Request, res: Response) => {
  try {
    const [inverterTypes, productDescriptions, structures] = await Promise.all([
      inverterTypeQueries.getAllInverterTypes(),
      productDescriptionQueries.getAllProductDescriptions(),
      structureQueries.getAllStructures()
    ]);

    res.status(200).json({
      message: "All category items retrieved successfully",
      data: {
        inverter_types: inverterTypes,
        product_descriptions: productDescriptions,
        structures: structures
      }
    });
  } catch (error: any) {
    console.error("Error fetching all category items:", error);
    res.status(500).json({
      message: "Error fetching all category items",
      error: error.message
    });
  }
};

// Update item in any category
export const updateCategoryItem = async (req: Request, res: Response) => {
  try {
    const { categoryType, id } = req.params;
    const { name, description, specifications, category, material, status } = req.body;

    let updated = false;

    switch (categoryType) {
      case 'inverter_types':
        // Check if new name already exists (excluding current record)
        if (name) {
          const existingInverter = await inverterTypeQueries.getInverterTypeById(parseInt(id));
          if (!existingInverter) {
            return res.status(404).json({ message: "Inverter type not found" });
          }
          
          if (name !== existingInverter.name) {
            const nameExists = await inverterTypeQueries.inverterTypeNameExists(name, parseInt(id));
            if (nameExists) {
              return res.status(400).json({ message: "Inverter type with this name already exists" });
            }
          }
        }
        
        updated = await inverterTypeQueries.updateInverterType(parseInt(id), {
          name, status, updated_by: (res.locals as any).user.id
        });
        break;

      case 'product_descriptions':
        // Check if new name already exists in category (excluding current record)
        if (name) {
          const existingProduct = await productDescriptionQueries.getProductDescriptionById(parseInt(id));
          if (!existingProduct) {
            return res.status(404).json({ message: "Product description not found" });
          }
          
          if (name !== existingProduct.name) {
            const nameExists = await productDescriptionQueries.productDescriptionNameExists(name, category, parseInt(id));
            if (nameExists) {
              return res.status(400).json({ message: "Product description with this name already exists in this category" });
            }
          }
        }
        
        updated = await productDescriptionQueries.updateProductDescription(parseInt(id), {
          name, status
        }, (res.locals as any).user.id);
        break;

      case 'structures':
        // Check if new name already exists (excluding current record)
        if (name) {
          const existingStructure = await structureQueries.getStructureById(parseInt(id));
          if (!existingStructure) {
            return res.status(404).json({ message: "Structure not found" });
          }
          
          if (name !== existingStructure.name) {
            const nameExists = await structureQueries.structureNameExists(name, parseInt(id));
            if (nameExists) {
              return res.status(400).json({ message: "Structure with this name already exists" });
            }
          }
        }
        
        updated = await structureQueries.updateStructure(parseInt(id), {
          name, status
        }, (res.locals as any).user.id);
        break;

      default:
        return res.status(400).json({
          message: "Invalid category type. Must be one of: inverter_types, product_descriptions, structures"
        });
    }

    if (!updated) {
      return res.status(400).json({ message: "No changes were made" });
    }

    res.status(200).json({
      message: `${categoryType} item updated successfully`
    });
  } catch (error: any) {
    console.error("Error updating category item:", error);
    res.status(500).json({
      message: "Error updating category item",
      error: error.message
    });
  }
};

// Delete item from any category
export const deleteCategoryItem = async (req: Request, res: Response) => {
  try {
    const { categoryType, id } = req.params;
    let deleted = false;

    switch (categoryType) {
      case 'inverter_types':
        deleted = await inverterTypeQueries.deleteInverterType(parseInt(id));
        break;
      case 'product_descriptions':
        deleted = await productDescriptionQueries.deleteProductDescription(parseInt(id));
        break;
      case 'structures':
        deleted = await structureQueries.deleteStructure(parseInt(id));
        break;
      default:
        return res.status(400).json({
          message: "Invalid category type. Must be one of: inverter_types, product_descriptions, structures"
        });
    }

    if (!deleted) {
      return res.status(404).json({
        message: `${categoryType} item not found`
      });
    }

    res.status(200).json({
      message: `${categoryType} item deleted successfully`
    });
  } catch (error: any) {
    console.error("Error deleting category item:", error);
    res.status(500).json({
      message: "Error deleting category item",
      error: error.message
    });
  }
};