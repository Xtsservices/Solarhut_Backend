import Joi from "joi";

// Joi validation schemas for Unified Solar Capacities

// ===== UNIFIED SOLAR CAPACITY VALIDATIONS =====

export const createSolarCapacitySchema = Joi.object({
  category: Joi.string()
    .valid('inverter_types', 'product_descriptions', 'structures')
    .required()
    .messages({
      'any.only': 'Category must be one of: inverter_types, product_descriptions, structures',
      'any.required': 'Category is required'
    }),
    
  name: Joi.string()
    .trim()
    .min(2)
    .max(255)
    .required()
    .messages({
      'string.base': 'Name must be a string',
      'string.empty': 'Name is required',
      'string.min': 'Name must be at least 2 characters',
      'string.max': 'Name cannot exceed 255 characters',
      'any.required': 'Name is required'
    }),
  
  status: Joi.string()
    .valid('Active', 'Inactive')
    .default('Active')
    .optional()
    .messages({
      'string.base': 'Status must be a string',
      'any.only': 'Status must be either Active or Inactive'
    })
});

export const updateSolarCapacitySchema = Joi.object({
  category: Joi.string()
    .valid('inverter_types', 'product_descriptions', 'structures')
    .required()
    .messages({
      'any.only': 'Category must be one of: inverter_types, product_descriptions, structures',
      'any.required': 'Category is required'
    }),
    
  name: Joi.string()
    .trim()
    .min(2)
    .max(255)
    .optional()
    .messages({
      'string.base': 'Name must be a string',
      'string.empty': 'Name cannot be empty',
      'string.min': 'Name must be at least 2 characters',
      'string.max': 'Name cannot exceed 255 characters'
    }),
  
  status: Joi.string()
    .valid('Active', 'Inactive')
    .optional()
    .messages({
      'any.only': 'Status must be either Active or Inactive'
    }),
  
  updated_by: Joi.number()
    .integer()
    .positive()
    .optional()
    .messages({
      'number.base': 'Updated by must be a number',
      'number.integer': 'Updated by must be an integer',
      'number.positive': 'Updated by must be positive'
    })
});

export const deleteSolarCapacitySchema = Joi.object({
  category: Joi.string()
    .valid('inverter_types', 'product_descriptions', 'structures')
    .required()
    .messages({
      'any.only': 'Category must be one of: inverter_types, product_descriptions, structures',
      'any.required': 'Category is required'
    })
});

// ===== PARAMETER VALIDATIONS =====

// Validation for ID parameter
export const idParamSchema = Joi.object({
  id: Joi.number()
    .integer()
    .min(1)
    .required()
    .messages({
      'number.base': 'ID must be a number',
      'number.integer': 'ID must be an integer',
      'number.min': 'ID must be greater than 0',
      'any.required': 'ID is required'
    })
});

// Validation for category type parameter
export const categoryParamSchema = Joi.object({
  categoryType: Joi.string()
    .valid('inverter_types', 'product_descriptions', 'structures')
    .required()
    .messages({
      'any.only': 'Category type must be one of: inverter_types, product_descriptions, structures',
      'any.required': 'Category type is required'
    })
});