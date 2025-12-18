import Joi from 'joi';

export const estimationSchema = Joi.object({
    customer_name: Joi.string().max(200).required(),
    door_no: Joi.string().max(50).required(),
    area: Joi.string().max(100).required(),
    city: Joi.string().max(100).required(),
    district: Joi.string().max(100).required(),
    state: Joi.string().max(100).required(),
    pincode: Joi.string().pattern(/^\d{6}$/).required().messages({
        'string.pattern.base': 'Pincode must be a 6 digit number.'
    }),
    mobile: Joi.string().pattern(/^\d{10,15}$/).required().messages({
        'string.pattern.base': 'Mobile must be 10-15 digits.'
    }),
    product_description: Joi.string().allow('', null),
    requested_watts: Joi.string().allow('', null),
    gst: Joi.number().min(0).max(100).default(18),
    amount: Joi.number().min(0).required(),
    created_by: Joi.number().integer().allow(null),
    updated_by: Joi.number().integer().allow(null),
    status: Joi.string().valid('Active', 'Inactive').default('Active'),
    // created_at, updated_at are handled by DB
});


export const employeeSchema = {
    create: Joi.object({
        first_name: Joi.string()
            .regex(/^[A-Za-z]{2,50}$/)
            .required()
            .messages({
                'string.pattern.base': 'First name must contain only alphabets and be between 2-50 characters',
                'string.empty': 'First name is required',
                'any.required': 'First name is required'
            }),
        last_name: Joi.string()
            .regex(/^[A-Za-z]{2,50}$/)
            .required()
            .messages({
                'string.pattern.base': 'Last name must contain only alphabets and be between 2-50 characters',
                'string.empty': 'Last name is required',
                'any.required': 'Last name is required'
            }),
        email: Joi.string()
            .email()
            .required()
            .messages({
                'string.email': 'Invalid email format',
                'string.empty': 'Email is required',
                'any.required': 'Email is required'
            }),
        mobile: Joi.string()
            .pattern(/^(\+\d{7,15}|[6-9]\d{9})$/)
            .required()
            .messages({
                'string.pattern.base': 'Invalid mobile number format. Use 10-digit Indian format or international format with country code',
                'string.empty': 'Mobile number is required',
                'any.required': 'Mobile number is required'
            }),
        address: Joi.string()
            .max(500)
            .optional()
            .messages({
                'string.max': 'Address cannot exceed 500 characters'
            }),
        joining_date: Joi.date()
            .required()
            .messages({
                'date.base': 'Invalid joining date',
                'any.required': 'Joining date is required'
            }),
        roles: Joi.array()
            .items(Joi.string().trim())
            .min(1)
            .required()
            .messages({
                'array.min': 'At least one role must be assigned',
                'any.required': 'At least one role is required',
                'string.base': 'Role names must be strings'
            })
    }),
    update: Joi.object({
        first_name: Joi.string()
            .regex(/^[A-Za-z]{2,50}$/)
            .messages({
                'string.pattern.base': 'First name must contain only alphabets and be between 2-50 characters'
            }),
        last_name: Joi.string()
            .regex(/^[A-Za-z]{2,50}$/)
            .messages({
                'string.pattern.base': 'Last name must contain only alphabets and be between 2-50 characters'
            }),
        email: Joi.string()
            .email()
            .messages({
                'string.email': 'Invalid email format'
            }),
        mobile: Joi.string()
            .pattern(/^(\+\d{7,15}|[6-9]\d{9})$/)
            .messages({
                'string.pattern.base': 'Invalid mobile number format. Use 10-digit Indian format or international format with country code'
            }),
        date_of_birth: Joi.date()
            .max('now')
            .messages({
                'date.max': 'Date of birth cannot be in the future'
            }),
        address: Joi.string()
            .max(500)
            .messages({
                'string.max': 'Address cannot exceed 500 characters'
            }),
        joining_date: Joi.date()
            .messages({
                'date.base': 'Invalid joining date'
            }),
        status: Joi.string()
            .valid('Active', 'Inactive', 'On Leave')
            .messages({
                'any.only': 'Invalid status value'
            })
    }),
    assignRoles: Joi.object({
        roles: Joi.array()
            .items(Joi.object({
                role_id: Joi.number().required()
            }))
            .min(1)
            .required()
            .messages({
                'array.min': 'At least one role must be assigned',
                'any.required': 'Roles are required'
            })
    })
};



export const authSchema = {
    requestOTP: Joi.object({
        mobile: Joi.string()
            .pattern(/^(\+\d{7,15}|[6-9]\d{9})$/)
            .required()
            .messages({
                'string.pattern.base': 'Invalid mobile number format. Use 10-digit Indian format or international format with country code',
                'string.empty': 'Mobile number is required',
                'any.required': 'Mobile number is required'
            })
    }),
    verifyOTP: Joi.object({
        mobile: Joi.string()
            .pattern(/^(\+\d{7,15}|[6-9]\d{9})$/)
            .required()
            .messages({
                'string.pattern.base': 'Invalid mobile number format',
                'string.empty': 'Mobile number is required',
                'any.required': 'Mobile number is required'
            }),
        otp: Joi.string()
            .pattern(/^\d{6}$/)
            .required()
            .messages({
                'string.pattern.base': 'OTP must be 6 digits',
                'string.empty': 'OTP is required',
                'any.required': 'OTP is required'
            })
    })
};



export const leadSchema = {
    create: Joi.object({
        first_name: Joi.string()
            .regex(/^[A-Za-z]{2,50}$/)
            .required()
            .messages({
                'string.pattern.base': 'First name must contain only alphabets and be between 2-50 characters',
                'string.empty': 'First name is required',
                'any.required': 'First name is required'
            }),

        last_name: Joi.string()
            .regex(/^[A-Za-z]{2,50}$/)
            .required()
            .messages({
                'string.pattern.base': 'Last name must contain only alphabets and be between 2-50 characters',
                'string.empty': 'Last name is required',
                'any.required': 'Last name is required'
            }),

        mobile: Joi.string()
            .pattern(/^(\+\d{7,15}|[6-9]\d{9})$/)
            .required()
            .messages({
                'string.pattern.base': 'Invalid mobile number format. Use 10-digit Indian format or international format with country code',
                'string.empty': 'Mobile number is required',
                'any.required': 'Mobile number is required'
            }),

        email: Joi.string()
            .email()
            .optional()
            .allow(null, '')
            .messages({
                'string.email': 'Invalid email format'
            }),

        service_type: Joi.string()
            .valid('Installation', 'Maintenance')
            .required()
            .messages({
                'any.only': 'Service type must be either Installation or Maintenance',
                'any.required': 'Service type is required'
            }),

        solar_service: Joi.string()
            .valid('Residential Solar', 'Commercial Solar', 'Industrial Solar')
            .required()
            .messages({
                'any.only': 'Solar service must be either Residential Solar, Commercial Solar or Industrial Solar',
                'any.required': 'Solar service is required'
            }),

        capacity: Joi.string()
            .pattern(/^\d+(\.\d+)?\s*(Tons?|KW|KVA|MW|W)$/i)
            .required()
            .messages({
                'string.pattern.base': 'Invalid capacity format. Use format like "2 Tons" or "10 KW"',
                'string.empty': 'Capacity is required',
                'any.required': 'Capacity is required'
            }),

        message: Joi.string()
            .min(5)
            .max(500)
            .required()
            .messages({
                'string.min': 'Message must be at least 5 characters long',
                'string.max': 'Message cannot exceed 500 characters',
                'string.empty': 'Message is required',
                'any.required': 'Message is required'
            }),

        location: Joi.string()
            .required()
            .trim()
            .min(1)
            .messages({
                'string.empty': 'Location is required',
                'any.required': 'Location is required'
            }),

        property_type: Joi.string()
            .required()
            .when('solar_service', {
                is: 'Residential Solar',
                then: Joi.string().valid('Independent House', 'Apartment', 'Villa', 'Farmhouse', 'Others'),
                otherwise: Joi.when('solar_service', {
                    is: 'Commercial Solar',
                    then: Joi.string().valid('Office Building', 'Shop/Showroom', 'Shopping Mall', 'Hotel/Resort', 'Hospital', 'School/College', 'Others'),
                    otherwise: Joi.string().valid('Factory', 'Warehouse', 'Manufacturing Unit', 'Processing Plant', 'Others')
                })
            })
            .messages({
                'any.only': 'Invalid property type for selected solar service',
                'any.required': 'Property type is required'
            })
    })
};

export const packageSchema = {
    create: Joi.object({
        name: Joi.string().min(1).max(255).required().messages({
            'string.empty': 'Package name is required',
            'any.required': 'Package name is required'
        }),
        capacity: Joi.string().min(1).max(50).required().messages({
            'string.empty': 'Capacity is required',
            'any.required': 'Capacity is required'
        }),
        price: Joi.number().precision(2).positive().required().messages({
            'number.base': 'Price must be a number',
            'number.positive': 'Price must be positive',
            'any.required': 'Price is required'
        }),
        original_price: Joi.number().precision(2).positive().optional().allow(null),
        savings: Joi.number().precision(2).optional().allow(null),
        monthly_generation: Joi.string().max(255).optional().allow(null, ''),
        features: Joi.string().max(500).optional().allow(null, ''),
        status: Joi.string().valid('Active', 'Inactive').optional()
    }),
    update: Joi.object({
        name: Joi.string().min(1).max(255).optional(),
        capacity: Joi.string().min(1).max(50).optional(),
        price: Joi.number().precision(2).positive().optional(),
        original_price: Joi.number().precision(2).positive().optional().allow(null),
        savings: Joi.number().precision(2).optional().allow(null),
        monthly_generation: Joi.string().max(255).optional().allow(null, ''),
        features: Joi.string().max(500).optional().allow(null, ''),
        status: Joi.string().valid('Active', 'Inactive').optional()
    })
};

export const featureSchema = {
    create: Joi.object({
        feature_name: Joi.string().min(1).max(255).required().messages({
            'string.empty': 'Feature name is required',
            'any.required': 'Feature name is required'
        }),
        status: Joi.string().valid('Active', 'Inactive').optional()
    }),
    update: Joi.object({
        feature_name: Joi.string().min(1).max(255).optional(),
        status: Joi.string().valid('Active', 'Inactive').optional()
    })
};

export const permissionSchema = {
    create: Joi.object({
        role_id: Joi.number().integer().positive().required().messages({
            'number.base': 'Role ID must be a number',
            'number.positive': 'Role ID must be positive',
            'any.required': 'Role ID is required'
        }),
        feature_id: Joi.number().integer().positive().required().messages({
            'number.base': 'Feature ID must be a number',
            'number.positive': 'Feature ID must be positive',
            'any.required': 'Feature ID is required'
        }),
        permissions: Joi.array().items(
            Joi.string().valid('create', 'read', 'edit', 'delete')
        ).min(1).required().messages({
            'array.min': 'At least one permission is required',
            'any.required': 'Permissions array is required'
        }),
        status: Joi.string().valid('Active', 'Inactive').optional()
    }),
    update: Joi.object({
        permissions: Joi.array().items(
            Joi.string().valid('create', 'read', 'edit', 'delete')
        ).min(1).optional().messages({
            'array.min': 'At least one permission is required if permissions are provided'
        }),
        status: Joi.string().valid('Active', 'Inactive').optional(),
        updated_by: Joi.number().integer().positive().optional()
    }).min(1).messages({
        'object.min': 'At least one field (permissions or status) must be provided'
    }),
    bulkCreate: Joi.object({
        permissions: Joi.array().items(
            Joi.object({
                role_id: Joi.number().integer().positive().required(),
                feature_id: Joi.number().integer().positive().required(),
                permissions: Joi.array().items(
                    Joi.string().valid('create', 'read', 'edit', 'delete')
                ).min(1).required()
            })
        ).min(1).required().messages({
            'array.min': 'At least one permission set is required'
        })
    })
};

export const countrySchema = {
    create: Joi.object({
        country_code: Joi.string()
            .length(2)
            .uppercase()
            .required()
            .pattern(/^[A-Z]{2}$/)
            .messages({
                'string.empty': 'Country code is required',
                'string.length': 'Country code must be exactly 2 characters long',
                'string.pattern.base': 'Country code must contain only uppercase letters',
                'any.required': 'Country code is required'
            }),
        name: Joi.string()
            .min(2)
            .max(100)
            .required()
            .trim()
            .messages({
                'string.empty': 'Country name is required',
                'string.min': 'Country name must be at least 2 characters long',
                'string.max': 'Country name cannot exceed 100 characters',
                'any.required': 'Country name is required'
            }),
        alias_name: Joi.string()
            .max(100)
            .optional()
            .allow(null, '')
            .trim()
            .messages({
                'string.max': 'Alias name cannot exceed 100 characters'
            }),
        currency_format: Joi.string()
            .min(1)
            .max(10)
            .required()
            .uppercase()
            .messages({
                'string.empty': 'Currency format is required',
                'string.min': 'Currency format must be at least 1 character long',
                'string.max': 'Currency format cannot exceed 10 characters',
                'any.required': 'Currency format is required'
            }),
        status: Joi.string().valid('Active', 'Inactive').optional()
    }),
    update: Joi.object({
        country_code: Joi.string()
            .length(3)
            .uppercase()
            .optional()
            .pattern(/^[A-Z]{3}$/)
            .messages({
                'string.length': 'Country code must be exactly 3 characters long',
                'string.pattern.base': 'Country code must contain only uppercase letters'
            }),
        name: Joi.string()
            .min(2)
            .max(100)
            .optional()
            .trim()
            .messages({
                'string.min': 'Country name must be at least 2 characters long',
                'string.max': 'Country name cannot exceed 100 characters'
            }),
        alias_name: Joi.string()
            .max(100)
            .optional()
            .allow(null, '')
            .trim()
            .messages({
                'string.max': 'Alias name cannot exceed 100 characters'
            }),
        currency_format: Joi.string()
            .min(1)
            .max(10)
            .optional()
            .uppercase()
            .messages({
                'string.min': 'Currency format must be at least 1 character long',
                'string.max': 'Currency format cannot exceed 10 characters'
            }),
        status: Joi.string().valid('Active', 'Inactive').optional()
    })
};

export const stateSchema = {
    create: Joi.object({
        country_id: Joi.number()
            .integer()
            .positive()
            .required()
            .messages({
                'number.base': 'Country ID must be a number',
                'number.integer': 'Country ID must be an integer',
                'number.positive': 'Country ID must be a positive number',
                'any.required': 'Country ID is required'
            }),
        state_code: Joi.string()
            .min(1)
            .max(5)
            .uppercase()
            .required()
            .pattern(/^[A-Z0-9]+$/)
            .messages({
                'string.empty': 'State code is required',
                'string.min': 'State code must be at least 1 character long',
                'string.max': 'State code cannot exceed 5 characters',
                'string.pattern.base': 'State code must contain only uppercase letters and numbers',
                'any.required': 'State code is required'
            }),
        name: Joi.string()
            .min(2)
            .max(100)
            .required()
            .trim()
            .messages({
                'string.empty': 'State name is required',
                'string.min': 'State name must be at least 2 characters long',
                'string.max': 'State name cannot exceed 100 characters',
                'any.required': 'State name is required'
            }),
        alias_name: Joi.string()
            .max(100)
            .optional()
            .allow(null, '')
            .trim()
            .messages({
                'string.max': 'Alias name cannot exceed 100 characters'
            }),
        type: Joi.string()
            .valid('State', 'UT')
            .required()
            .messages({
                'string.empty': 'Type is required',
                'any.only': 'Type must be either "State" or "UT"',
                'any.required': 'Type is required'
            }),
        status: Joi.string().valid('Active', 'Inactive').optional()
    }),
    update: Joi.object({
        country_id: Joi.number()
            .integer()
            .positive()
            .optional()
            .messages({
                'number.base': 'Country ID must be a number',
                'number.integer': 'Country ID must be an integer',
                'number.positive': 'Country ID must be a positive number'
            }),
        state_code: Joi.string()
            .min(1)
            .max(5)
            .uppercase()
            .optional()
            .pattern(/^[A-Z0-9]+$/)
            .messages({
                'string.min': 'State code must be at least 1 character long',
                'string.max': 'State code cannot exceed 5 characters',
                'string.pattern.base': 'State code must contain only uppercase letters and numbers'
            }),
        name: Joi.string()
            .min(2)
            .max(100)
            .optional()
            .trim()
            .messages({
                'string.min': 'State name must be at least 2 characters long',
                'string.max': 'State name cannot exceed 100 characters'
            }),
        alias_name: Joi.string()
            .max(100)
            .optional()
            .allow(null, '')
            .trim()
            .messages({
                'string.max': 'Alias name cannot exceed 100 characters'
            }),
        type: Joi.string()
            .valid('State', 'UT')
            .optional()
            .messages({
                'any.only': 'Type must be either "State" or "UT"'
            }),
        status: Joi.string().valid('Active', 'Inactive').optional()
    })
};

export const districtSchema = {
    create: Joi.object({
        state_id: Joi.number()
            .integer()
            .positive()
            .required()
            .messages({
                'number.base': 'State ID must be a number',
                'number.integer': 'State ID must be an integer',
                'number.positive': 'State ID must be a positive number',
                'any.required': 'State ID is required'
            }),
        district_code: Joi.string()
            .min(1)
            .max(5)
            .uppercase()
            .required()
            .pattern(/^[A-Z0-9]+$/)
            .messages({
                'string.empty': 'District code is required',
                'string.min': 'District code must be at least 1 character long',
                'string.max': 'District code cannot exceed 5 characters',
                'string.pattern.base': 'District code must contain only uppercase letters and numbers',
                'any.required': 'District code is required'
            }),
        name: Joi.string()
            .min(2)
            .max(100)
            .required()
            .trim()
            .messages({
                'string.empty': 'District name is required',
                'string.min': 'District name must be at least 2 characters long',
                'string.max': 'District name cannot exceed 100 characters',
                'any.required': 'District name is required'
            }),
        alias_name: Joi.string()
            .max(100)
            .optional()
            .allow(null, '')
            .trim()
            .messages({
                'string.max': 'Alias name cannot exceed 100 characters'
            }),
        status: Joi.string().valid('Active', 'Inactive').optional()
    }),
    update: Joi.object({
        state_id: Joi.number()
            .integer()
            .positive()
            .optional()
            .messages({
                'number.base': 'State ID must be a number',
                'number.integer': 'State ID must be an integer',
                'number.positive': 'State ID must be a positive number'
            }),
        district_code: Joi.string()
            .min(1)
            .max(5)
            .uppercase()
            .optional()
            .pattern(/^[A-Z0-9]+$/)
            .messages({
                'string.min': 'District code must be at least 1 character long',
                'string.max': 'District code cannot exceed 5 characters',
                'string.pattern.base': 'District code must contain only uppercase letters and numbers'
            }),
        name: Joi.string()
            .min(2)
            .max(100)
            .optional()
            .trim()
            .messages({
                'string.min': 'District name must be at least 2 characters long',
                'string.max': 'District name cannot exceed 100 characters'
            }),
        alias_name: Joi.string()
            .max(100)
            .optional()
            .allow(null, '')
            .trim()
            .messages({
                'string.max': 'Alias name cannot exceed 100 characters'
            }),
        status: Joi.string().valid('Active', 'Inactive').optional()
    })
};

export const customerSchema = {
    create: Joi.object({
        customer_code: Joi.string()
            .min(5)
            .max(20)
            .optional()
            .pattern(/^[A-Z0-9_-]+$/)
            .messages({
                'string.min': 'Customer code must be at least 5 characters long',
                'string.max': 'Customer code cannot exceed 20 characters',
                'string.pattern.base': 'Customer code must contain only uppercase letters, numbers, hyphens and underscores'
            }),
        first_name: Joi.string()
            .min(2)
            .max(100)
            .required()
            .trim()
            .messages({
                'string.empty': 'First name is required',
                'string.min': 'First name must be at least 2 characters long',
                'string.max': 'First name cannot exceed 100 characters',
                'any.required': 'First name is required'
            }),
        last_name: Joi.string()
            .max(100)
            .optional()
            .allow(null, '')
            .trim()
            .messages({
                'string.max': 'Last name cannot exceed 100 characters'
            }),
        
        mobile: Joi.string()
            .pattern(/^(\+\d{7,15}|[6-9]\d{9})$/)
            .required()
            .messages({
                'string.pattern.base': 'Invalid mobile number format',
                'string.empty': 'Mobile number is required',
                'any.required': 'Mobile number is required'
            }),
        email: Joi.string()
            .email()
            .optional()
            .allow(null, '')
            .messages({
                'string.email': 'Invalid email format'
            }),
        alternate_mobile: Joi.string()
            .pattern(/^(\+\d{7,15}|[6-9]\d{9})$/)
            .optional()
            .allow(null, '')
            .messages({
                'string.pattern.base': 'Invalid alternate mobile number format'
            }),
        date_of_birth: Joi.date()
            .optional()
            .allow(null)
            .messages({
                'date.base': 'Invalid date of birth'
            }),
        gender: Joi.string()
            .valid('Male', 'Female', 'Other')
            .optional()
            .allow(null),
        customer_type: Joi.string()
            .valid('Individual', 'Business', 'Corporate')
            .optional()
            .messages({
                'any.only': 'Customer type must be Individual, Business, or Corporate'
            }),
        company_name: Joi.string()
            .max(255)
            .optional()
            .allow(null, '')
            .trim()
            .messages({
                'string.max': 'Company name cannot exceed 255 characters'
            }),
        gst_number: Joi.string()
            .pattern(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/)
            .optional()
            .allow(null, '')
            .messages({
                'string.pattern.base': 'Invalid GST number format'
            }),
        pan_number: Joi.string()
            .pattern(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/)
            .optional()
            .allow(null, '')
            .messages({
                'string.pattern.base': 'Invalid PAN number format'
            }),
        lead_source: Joi.string()
            .max(100)
            .optional()
            .allow(null, '')
            .trim(),
        notes: Joi.string()
            .max(1000)
            .optional()
            .allow(null, '')
            .trim(),
        status: Joi.string()
            .valid('Active', 'Inactive', 'Blacklisted')
            .optional()
    }),
    update: Joi.object({
        first_name: Joi.string()
            .min(2)
            .max(100)
            .optional()
            .trim(),
        last_name: Joi.string()
            .max(100)
            .optional()
            .allow(null, '')
            .trim(),
        full_name: Joi.string()
            .min(2)
            .max(200)
            .optional()
            .trim(),
        mobile: Joi.string()
            .pattern(/^(\+\d{7,15}|[6-9]\d{9})$/)
            .optional(),
        email: Joi.string()
            .email()
            .optional()
            .allow(null, ''),
        alternate_mobile: Joi.string()
            .pattern(/^(\+\d{7,15}|[6-9]\d{9})$/)
            .optional()
            .allow(null, ''),
        date_of_birth: Joi.date()
            .optional()
            .allow(null),
        gender: Joi.string()
            .valid('Male', 'Female', 'Other')
            .optional()
            .allow(null),
        customer_type: Joi.string()
            .valid('Individual', 'Business', 'Corporate')
            .optional(),
        company_name: Joi.string()
            .max(255)
            .optional()
            .allow(null, '')
            .trim(),
        gst_number: Joi.string()
            .pattern(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/)
            .optional()
            .allow(null, ''),
        pan_number: Joi.string()
            .pattern(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/)
            .optional()
            .allow(null, ''),
        lead_source: Joi.string()
            .max(100)
            .optional()
            .allow(null, '')
            .trim(),
        notes: Joi.string()
            .max(1000)
            .optional()
            .allow(null, '')
            .trim(),
        status: Joi.string()
            .valid('Active', 'Inactive', 'Blacklisted')
            .optional()
    })
};

// Customer Location validation schemas
export const customerLocationSchema = {
    create: Joi.object({
        customer_id: Joi.number()
            .integer()
            .positive()
            .required()
            .messages({
                'number.base': 'Customer ID must be a number',
                'number.integer': 'Customer ID must be an integer',
                'number.positive': 'Customer ID must be a positive number',
                'any.required': 'Customer ID is required'
            }),
        location_type: Joi.string()
            .valid('Home', 'Office', 'Billing', 'Installation', 'Other')
            .required()
            .messages({
                'any.only': 'Location type must be Home, Office, Billing, Installation, or Other',
                'any.required': 'Location type is required'
            }),
        address_line_1: Joi.string()
            .max(255)
            .optional()
            .allow(null, '')
            .trim(),
        address_line_2: Joi.string()
            .max(255)
            .optional()
            .allow(null, '')
            .trim(),
        city: Joi.string()
            .max(100)
            .optional()
            .allow(null, '')
            .trim(),
        district_id: Joi.number()
            .integer()
            .positive()
            .optional()
            .allow(null),
        state_id: Joi.number()
            .integer()
            .positive()
            .optional()
            .allow(null),
        country_id: Joi.number()
            .integer()
            .positive()
            .optional()
            .allow(null),
        pincode: Joi.string()
            .pattern(/^[0-9]{4,10}$/)
            .optional()
            .allow(null, '')
            .messages({
                'string.pattern.base': 'Pincode must be 4-10 digits'
            }),
        landmark: Joi.string()
            .max(255)
            .optional()
            .allow(null, '')
            .trim(),
        latitude: Joi.number()
            .min(-90)
            .max(90)
            .optional()
            .allow(null),
        longitude: Joi.number()
            .min(-180)
            .max(180)
            .optional()
            .allow(null),
        is_primary: Joi.boolean()
            .optional()
            .default(false)
    }),
    update: Joi.object({
        location_type: Joi.string()
            .valid('Home', 'Office', 'Billing', 'Installation', 'Other')
            .optional(),
        address_line_1: Joi.string()
            .max(255)
            .optional()
            .allow(null, '')
            .trim(),
        address_line_2: Joi.string()
            .max(255)
            .optional()
            .allow(null, '')
            .trim(),
        city: Joi.string()
            .max(100)
            .optional()
            .allow(null, '')
            .trim(),
        district_id: Joi.number()
            .integer()
            .positive()
            .optional()
            .allow(null),
        state_id: Joi.number()
            .integer()
            .positive()
            .optional()
            .allow(null),
        country_id: Joi.number()
            .integer()
            .positive()
            .optional()
            .allow(null),
        pincode: Joi.string()
            .pattern(/^[0-9]{4,10}$/)
            .optional()
            .allow(null, ''),
        landmark: Joi.string()
            .max(255)
            .optional()
            .allow(null, '')
            .trim(),
        latitude: Joi.number()
            .min(-90)
            .max(90)
            .optional()
            .allow(null),
        longitude: Joi.number()
            .min(-180)
            .max(180)
            .optional()
            .allow(null),
        is_primary: Joi.boolean()
            .optional()
    })
};

// Job validation schemas
export const jobSchema = {
    create: Joi.object({
        job_code: Joi.string()
            .min(3)
            .max(20)
            .optional()
            .pattern(/^[A-Z0-9_-]+$/)
            .messages({
                'string.min': 'Job code must be at least 3 characters long',
                'string.max': 'Job code cannot exceed 20 characters',
                'string.pattern.base': 'Job code must contain only uppercase letters, numbers, hyphens and underscores'
            }),
        lead_id: Joi.number()
            .integer()
            .positive()
            .optional()
            .allow(null)
            .messages({
                'number.base': 'Lead ID must be a number',
                'number.integer': 'Lead ID must be an integer',
                'number.positive': 'Lead ID must be a positive number'
            }),
        customer_id: Joi.number()
            .integer()
            .positive()
            .optional()
            .allow(null)
            .messages({
                'number.base': 'Customer ID must be a number',
                'number.integer': 'Customer ID must be an integer',
                'number.positive': 'Customer ID must be a positive number'
            }),
        // Customer details (required if customer_id not provided)
        customer: Joi.object({
            first_name: Joi.string()
                .min(2)
                .max(100)
                .required()
                .trim()
                .messages({
                    'string.empty': 'First name is required',
                    'string.min': 'First name must be at least 2 characters long',
                    'string.max': 'First name cannot exceed 100 characters',
                    'any.required': 'First name is required'
                }),
            last_name: Joi.string()
                .max(100)
                .optional()
                .allow(null, '')
                .trim()
                .messages({
                    'string.max': 'Last name cannot exceed 100 characters'
                }),
            full_name: Joi.string()
                .min(2)
                .max(200)
                .optional()
                .allow(null, '')
                .trim()
                .messages({
                    'string.min': 'Full name must be at least 2 characters long',
                    'string.max': 'Full name cannot exceed 200 characters'
                }),
            mobile: Joi.string()
                .pattern(/^(\+\d{7,15}|[6-9]\d{9})$/)
                .required()
                .messages({
                    'string.pattern.base': 'Invalid mobile number format',
                    'string.empty': 'Mobile number is required',
                    'any.required': 'Mobile number is required'
                }),
            email: Joi.string()
                .email()
                .optional()
                .allow(null, '')
                .messages({
                    'string.email': 'Invalid email format'
                }),
            alternate_mobile: Joi.string()
                .pattern(/^(\+\d{7,15}|[6-9]\d{9})$/)
                .optional()
                .allow(null, '')
                .messages({
                    'string.pattern.base': 'Invalid alternate mobile number format'
                }),
            customer_type: Joi.string()
                .valid('Individual', 'Business', 'Corporate')
                .optional()
                .messages({
                    'any.only': 'Customer type must be Individual, Business, or Corporate'
                }),
            company_name: Joi.string()
                .max(255)
                .optional()
                .allow(null, '')
                .trim(),
            gst_number: Joi.string()
                .pattern(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/)
                .optional()
                .allow(null, ''),
            pan_number: Joi.string()
                .pattern(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/)
                .optional()
                .allow(null, ''),
            lead_source: Joi.string()
                .max(100)
                .optional()
                .allow(null, '')
                .trim(),
            notes: Joi.string()
                .max(1000)
                .optional()
                .allow(null, '')
                .trim()
        }).optional(),
        location_id: Joi.number()
            .integer()
            .positive()
            .optional()
            .allow(null)
            .messages({
                'number.base': 'Location ID must be a number',
                'number.integer': 'Location ID must be an integer',
                'number.positive': 'Location ID must be a positive number'
            }),
        // Location details (required if location_id not provided)
        location: Joi.object({
            location_type: Joi.string()
                .valid('Home', 'Office', 'Billing', 'Installation', 'Other')
                .optional()
                .default('Installation')
                .messages({
                    'any.only': 'Location type must be Home, Office, Billing, Installation, or Other'
                }),
            address_line_1: Joi.string()
                .max(255)
                .required()
                .trim()
                .messages({
                    'string.empty': 'Address line 1 is required',
                    'any.required': 'Address line 1 is required'
                }),
            address_line_2: Joi.string()
                .max(255)
                .optional()
                .allow(null, '')
                .trim(),
            city: Joi.string()
                .max(100)
                .required()
                .trim()
                .messages({
                    'string.empty': 'City is required',
                    'any.required': 'City is required'
                }),
            district_id: Joi.number()
                .integer()
                .positive()
                .optional()
                .allow(null),
            state_id: Joi.number()
                .integer()
                .positive()
                .optional()
                .allow(null),
            country_id: Joi.number()
                .integer()
                .positive()
                .optional()
                .allow(null),
            pincode: Joi.string()
                .pattern(/^[0-9]{4,10}$/)
                .required()
                .messages({
                    'string.pattern.base': 'Pincode must be 4-10 digits',
                    'string.empty': 'Pincode is required',
                    'any.required': 'Pincode is required'
                }),
            landmark: Joi.string()
                .max(255)
                .optional()
                .allow(null, '')
                .trim(),
            latitude: Joi.number()
                .min(-90)
                .max(90)
                .optional()
                .allow(null),
            longitude: Joi.number()
                .min(-180)
                .max(180)
                .optional()
                .allow(null),
            is_primary: Joi.boolean()
                .optional()
                .default(false)
        }).optional(),
        service_type: Joi.string()
            .valid('Installation', 'Maintenance', 'Repair')
            .required()
            .messages({
                'any.only': 'Service type must be Installation, Maintenance, or Repair',
                'any.required': 'Service type is required'
            }),
        solar_service: Joi.string()
            .valid('Residential Solar', 'Commercial Solar', 'Industrial Solar')
            .required()
            .messages({
                'any.only': 'Solar service must be Residential Solar, Commercial Solar, or Industrial Solar',
                'any.required': 'Solar service is required'
            }),
        package_id: Joi.number()
            .integer()
            .positive()
            .optional()
            .allow(null)
            .messages({
                'number.base': 'Package ID must be a number',
                'number.integer': 'Package ID must be an integer',
                'number.positive': 'Package ID must be a positive number'
            }),
        capacity: Joi.string()
            .max(50)
            .optional()
            .allow(null, '')
            .messages({
                'string.max': 'Capacity cannot exceed 50 characters'
            }),
        estimated_cost: Joi.number()
            .positive()
            .optional()
            .allow(null)
            .messages({
                'number.base': 'Estimated cost must be a number',
                'number.positive': 'Estimated cost must be positive'
            }),
        job_priority: Joi.string()
            .valid('Low', 'Medium', 'High', 'Urgent')
            .optional()
            .messages({
                'any.only': 'Job priority must be Low, Medium, High, or Urgent'
            }),
        scheduled_date: Joi.date()
            .optional()
            .allow(null)
            .messages({
                'date.base': 'Invalid scheduled date'
            }),
        job_description: Joi.string()
            .max(1000)
            .optional()
            .allow(null, '')
            .messages({
                'string.max': 'Job description cannot exceed 1000 characters'
            }),
        special_instructions: Joi.string()
            .max(1000)
            .optional()
            .allow(null, '')
            .messages({
                'string.max': 'Special instructions cannot exceed 1000 characters'
            }),
        status: Joi.string()
            .valid('Created', 'Assigned', 'In Progress', 'On Hold', 'Completed', 'Cancelled')
            .optional()
    }).custom((value, helpers) => {
        // Custom validation: Either customer_id or customer details must be provided
        if (!value.customer_id && !value.customer) {
            return helpers.error('any.required', { message: 'Either customer_id or customer details must be provided' });
        }
        
        // Custom validation: Either location_id or location details must be provided
        if (!value.location_id && !value.location) {
            return helpers.error('any.required', { message: 'Either location_id or location details must be provided' });
        }
        
        // If both customer_id and customer are provided, prefer customer_id
        if (value.customer_id && value.customer) {
            delete value.customer;
        }
        
        // If both location_id and location are provided, prefer location_id
        if (value.location_id && value.location) {
            delete value.location;
        }
        
        return value;
    }),
    update: Joi.object({
        customer_id: Joi.number()
            .integer()
            .positive()
            .optional(),
        location_id: Joi.number()
            .integer()
            .positive()
            .optional()
            .allow(null),
        service_type: Joi.string()
            .valid('Installation', 'Maintenance', 'Repair')
            .optional(),
        solar_service: Joi.string()
            .valid('Residential Solar', 'Commercial Solar', 'Industrial Solar')
            .optional(),
        package_id: Joi.number()
            .integer()
            .positive()
            .optional()
            .allow(null),
        capacity: Joi.string()
            .max(50)
            .optional()
            .allow(null, ''),
        estimated_cost: Joi.number()
            .positive()
            .optional()
            .allow(null),
        actual_cost: Joi.number()
            .positive()
            .optional()
            .allow(null),
        job_priority: Joi.string()
            .valid('Low', 'Medium', 'High', 'Urgent')
            .optional(),
        scheduled_date: Joi.date()
            .optional()
            .allow(null),
        completion_date: Joi.date()
            .optional()
            .allow(null),
        job_description: Joi.string()
            .max(1000)
            .optional()
            .allow(null, ''),
        special_instructions: Joi.string()
            .max(1000)
            .optional()
            .allow(null, ''),
        status: Joi.string()
            .valid('Created', 'Assigned', 'In Progress', 'On Hold', 'Completed', 'Cancelled')
            .optional()
    })
};

// Job Location validation schema
export const jobLocationSchema = {
    create: Joi.object({
        job_id: Joi.number()
            .integer()
            .positive()
            .required()
            .messages({
                'number.base': 'Job ID must be a number',
                'number.integer': 'Job ID must be an integer',
                'number.positive': 'Job ID must be a positive number',
                'any.required': 'Job ID is required'
            }),
        address_line_1: Joi.string()
            .min(5)
            .max(255)
            .required()
            .trim()
            .messages({
                'string.empty': 'Address line 1 is required',
                'string.min': 'Address line 1 must be at least 5 characters long',
                'string.max': 'Address line 1 cannot exceed 255 characters',
                'any.required': 'Address line 1 is required'
            }),
        address_line_2: Joi.string()
            .max(255)
            .optional()
            .allow(null, '')
            .trim(),
        city: Joi.string()
            .min(2)
            .max(100)
            .required()
            .trim()
            .messages({
                'string.empty': 'City is required',
                'string.min': 'City must be at least 2 characters long',
                'string.max': 'City cannot exceed 100 characters',
                'any.required': 'City is required'
            }),
        district_id: Joi.number()
            .integer()
            .positive()
            .optional()
            .allow(null),
        state_id: Joi.number()
            .integer()
            .positive()
            .optional()
            .allow(null),
        country_id: Joi.number()
            .integer()
            .positive()
            .optional()
            .allow(null),
        pincode: Joi.string()
            .pattern(/^[0-9]{4,10}$/)
            .required()
            .messages({
                'string.pattern.base': 'Pincode must be 4-10 digits',
                'string.empty': 'Pincode is required',
                'any.required': 'Pincode is required'
            }),
        landmark: Joi.string()
            .max(255)
            .optional()
            .allow(null, '')
            .trim(),
        latitude: Joi.number()
            .min(-90)
            .max(90)
            .optional()
            .allow(null),
        longitude: Joi.number()
            .min(-180)
            .max(180)
            .optional()
            .allow(null),
        location_type: Joi.string()
            .valid('Installation', 'Billing', 'Other')
            .optional()
    })
};

// Job Assignment validation schema
export const jobAssignmentSchema = {
    create: Joi.object({
        job_id: Joi.number()
            .integer()
            .positive()
            .required(),
        employee_id: Joi.number()
            .integer()
            .positive()
            .required(),
        role_type: Joi.string()
            .valid('Lead Technician', 'Technician', 'Helper', 'Supervisor', 'Sales Representative')
            .optional(),
        start_date: Joi.date()
            .optional()
            .allow(null),
        end_date: Joi.date()
            .optional()
            .allow(null),
        notes: Joi.string()
            .max(500)
            .optional()
            .allow(null, '')
    }),
    update: Joi.object({
        assignment_status: Joi.string()
            .valid('Assigned', 'Active', 'Completed', 'Cancelled')
            .optional(),
        start_date: Joi.date()
            .optional()
            .allow(null),
        end_date: Joi.date()
            .optional()
            .allow(null),
        work_hours: Joi.number()
            .positive()
            .optional()
            .allow(null),
        notes: Joi.string()
            .max(500)
            .optional()
            .allow(null, '')
    })
};

// Job Status Tracking validation schema
export const jobStatusTrackingSchema = {
    create: Joi.object({
        job_id: Joi.number()
            .integer()
            .positive()
            .required(),
        new_status: Joi.string()
            .valid('Created', 'Assigned', 'In Progress', 'On Hold', 'Completed', 'Cancelled')
            .required(),
        status_reason: Joi.string()
            .max(255)
            .optional()
            .allow(null, ''),
        comments: Joi.string()
            .max(1000)
            .optional()
            .allow(null, ''),
        attachment_url: Joi.string()
            .uri()
            .max(500)
            .optional()
            .allow(null, '')
    }),
    update: Joi.object({
        new_status: Joi.string()
            .valid('Created', 'Assigned', 'In Progress', 'On Hold', 'Completed', 'Cancelled')
            .required(),
        status_reason: Joi.string()
            .max(255)
            .optional()
            .allow(null, ''),
        comments: Joi.string()
            .max(1000)
            .optional()
            .allow(null, ''),
        attachment_url: Joi.string()
            .uri()
            .max(500)
            .optional()
            .allow(null, ''),
        // Payment details required when status is "Completed"
        payment_details: Joi.when('new_status', {
            is: 'Completed',
            then: Joi.object({
                amount: Joi.number()
                    .positive()
                    .required()
                    .messages({
                        'number.positive': 'Amount must be a positive number',
                        'any.required': 'Amount is required when completing a job'
                    }),
                discount_amount: Joi.number()
                    .min(0)
                    .optional()
                    .default(0),
                gst_rate: Joi.number()
                    .min(0)
                    .max(100)
                    .optional()
                    .default(18),
                cgst_rate: Joi.number()
                    .min(0)
                    .max(100)
                    .optional(),
                sgst_rate: Joi.number()
                    .min(0)
                    .max(100)
                    .optional(),
                igst_rate: Joi.number()
                    .min(0)
                    .max(100)
                    .optional(),
                payment_method: Joi.string()
                    .valid('Cash', 'Bank Transfer', 'UPI', 'Card', 'Cheque', 'Online')
                    .required()
                    .messages({
                        'any.required': 'Payment method is required when completing a job',
                        'any.only': 'Payment method must be one of: Cash, Bank Transfer, UPI, Card, Cheque, Online'
                    }),
                payment_status: Joi.string()
                    .valid('Pending', 'Completed')
                    .required()
                    .messages({
                        'any.required': 'Payment status is required when completing a job',
                        'any.only': 'Payment status must be either Pending or Completed'
                    }),
                transaction_id: Joi.string()
                    .max(100)
                    .required()
                    .messages({
                        'any.required': 'Transaction ID is required when completing a job',
                        'string.max': 'Transaction ID cannot exceed 100 characters'
                    }),
                payment_reference: Joi.string()
                    .max(100)
                    .optional()
                    .allow(null, ''),
                receipt_url: Joi.string()
                    .uri()
                    .max(500)
                    .optional()
                    .allow(null, '')
            }).required(),
            otherwise: Joi.forbidden()
        })
    })
};

// Job Payment validation schema
export const jobPaymentSchema = {
    create: Joi.object({
        job_id: Joi.number()
            .integer()
            .positive()
            .required(),
        payment_type: Joi.string()
            .valid('Advance', 'Milestone', 'Final', 'Refund')
            .required(),
        amount: Joi.number()
            .positive()
            .required(),
        discount_amount: Joi.number()
            .min(0)
            .optional()
            .default(0),
        taxable_amount: Joi.number()
            .positive()
            .required(),
        gst_rate: Joi.number()
            .min(0)
            .max(100)
            .optional()
            .default(0),
        cgst_rate: Joi.number()
            .min(0)
            .max(100)
            .optional()
            .default(0),
        sgst_rate: Joi.number()
            .min(0)
            .max(100)
            .optional()
            .default(0),
        igst_rate: Joi.number()
            .min(0)
            .max(100)
            .optional()
            .default(0),
        cgst_amount: Joi.number()
            .min(0)
            .optional()
            .default(0),
        sgst_amount: Joi.number()
            .min(0)
            .optional()
            .default(0),
        igst_amount: Joi.number()
            .min(0)
            .optional()
            .default(0),
        total_tax_amount: Joi.number()
            .min(0)
            .optional()
            .default(0),
        total_amount: Joi.number()
            .positive()
            .required(),
        payment_method: Joi.string()
            .valid('Cash', 'Bank Transfer', 'UPI', 'Card', 'Cheque', 'Online')
            .required(),
        payment_status: Joi.string()
            .valid('Pending', 'Completed', 'Failed', 'Cancelled', 'Refunded')
            .optional(),
        transaction_id: Joi.string()
            .max(100)
            .optional()
            .allow(null, ''),
        payment_reference: Joi.string()
            .max(100)
            .optional()
            .allow(null, ''),
        payment_date: Joi.date()
            .optional()
            .allow(null),
        due_date: Joi.date()
            .optional()
            .allow(null),
        milestone_description: Joi.string()
            .max(500)
            .optional()
            .allow(null, ''),
        receipt_url: Joi.string()
            .uri()
            .max(500)
            .optional()
            .allow(null, '')
    }),
    createFinalPayment: Joi.object({
        amount: Joi.number()
            .positive()
            .required(),
        discount_amount: Joi.number()
            .min(0)
            .optional()
            .default(0),
        gst_rate: Joi.number()
            .min(0)
            .max(100)
            .optional()
            .default(18),
        cgst_rate: Joi.number()
            .min(0)
            .max(100)
            .optional(),
        sgst_rate: Joi.number()
            .min(0)
            .max(100)
            .optional(),
        igst_rate: Joi.number()
            .min(0)
            .max(100)
            .optional(),
        payment_method: Joi.string()
            .valid('Cash', 'Bank Transfer', 'UPI', 'Card', 'Cheque', 'Online')
            .required(),
        payment_status: Joi.string()
            .valid('Pending', 'Completed')
            .optional()
            .default('Completed'),
        transaction_id: Joi.string()
            .max(100)
            .optional()
            .allow(null, ''),
        payment_reference: Joi.string()
            .max(100)
            .optional()
            .allow(null, ''),
        receipt_url: Joi.string()
            .uri()
            .max(500)
            .optional()
            .allow(null, '')
    }),
    update: Joi.object({
        payment_status: Joi.string()
            .valid('Pending', 'Completed', 'Failed', 'Cancelled', 'Refunded')
            .optional(),
        transaction_id: Joi.string()
            .max(100)
            .optional()
            .allow(null, ''),
        payment_reference: Joi.string()
            .max(100)
            .optional()
            .allow(null, ''),
        payment_date: Joi.date()
            .optional()
            .allow(null),
        milestone_description: Joi.string()
            .max(500)
            .optional()
            .allow(null, ''),
        receipt_url: Joi.string()
            .uri()
            .max(500)
            .optional()
            .allow(null, ''),
        payment_gateway_response: Joi.string()
            .max(1000)
            .optional()
            .allow(null, ''),
        processed_by: Joi.number()
            .integer()
            .positive()
            .optional()
            .allow(null),
        verified_by: Joi.number()
            .integer()
            .positive()
            .optional()
            .allow(null)
    })
};

// Role validation schemas
export const roleSchema = {
    create: Joi.object({
        role_name: Joi.string()
            .min(2)
            .max(100)
            .required()
            .trim()
            .messages({
                'string.min': 'Role name must be at least 2 characters long',
                'string.max': 'Role name cannot exceed 100 characters',
                'string.empty': 'Role name is required',
                'any.required': 'Role name is required'
            }),
        status: Joi.string()
            .valid('Active', 'Inactive')
            .optional()
            .default('Active')
            .messages({
                'any.only': 'Status must be either Active or Inactive'
            })
    }),
    update: Joi.object({
        role_name: Joi.string()
            .min(2)
            .max(100)
            .optional()
            .trim()
            .messages({
                'string.min': 'Role name must be at least 2 characters long',
                'string.max': 'Role name cannot exceed 100 characters'
            }),
        status: Joi.string()
            .valid('Active', 'Inactive')
            .optional()
            .messages({
                'any.only': 'Status must be either Active or Inactive'
            })
    })
};

// Contact validation schemas
export const contactSchema = {
    create: Joi.object({
        full_name: Joi.string()
            .min(2)
            .max(100)
            .required()
            .trim()
            .messages({
                'string.min': 'Full name must be at least 2 characters long',
                'string.max': 'Full name cannot exceed 100 characters',
                'string.empty': 'Full name is required',
                'any.required': 'Full name is required'
            }),
        email: Joi.string()
            .email()
            .required()
            .trim()
            .messages({
                'string.email': 'Invalid email format',
                'string.empty': 'Email is required',
                'any.required': 'Email is required'
            }),
        mobile: Joi.string()
            .pattern(/^(\+\d{7,15}|[6-9]\d{9})$/)
            .required()
            .messages({
                'string.pattern.base': 'Invalid mobile number format. Use 10-digit Indian format or international format with country code',
                'string.empty': 'Mobile number is required',
                'any.required': 'Mobile number is required'
            }),
        reason: Joi.string()
            .min(2)
            .max(100)
            .required()
            .trim()
            .messages({
                'string.min': 'Reason must be at least 2 characters long',
                'string.max': 'Reason cannot exceed 100 characters',
                'string.empty': 'Reason is required',
                'any.required': 'Reason is required'
            }),
        message: Joi.string()
            .max(1000)
            .optional()
            .allow(null, '')
            .trim()
            .messages({
                'string.max': 'Message cannot exceed 1000 characters'
            }),
        status: Joi.string()
            .valid('New', 'In Progress', 'Resolved', 'Closed')
            .optional()
            .default('New')
            .messages({
                'any.only': 'Status must be one of: New, In Progress, Resolved, Closed'
            })
    }),
    update: Joi.object({
        full_name: Joi.string()
            .min(2)
            .max(100)
            .optional()
            .trim()
            .messages({
                'string.min': 'Full name must be at least 2 characters long',
                'string.max': 'Full name cannot exceed 100 characters'
            }),
        email: Joi.string()
            .email()
            .optional()
            .trim()
            .messages({
                'string.email': 'Invalid email format'
            }),
        mobile: Joi.string()
            .pattern(/^(\+\d{7,15}|[6-9]\d{9})$/)
            .optional()
            .messages({
                'string.pattern.base': 'Invalid mobile number format. Use 10-digit Indian format or international format with country code'
            }),
        reason: Joi.string()
            .min(2)
            .max(100)
            .optional()
            .trim()
            .messages({
                'string.min': 'Reason must be at least 2 characters long',
                'string.max': 'Reason cannot exceed 100 characters'
            }),
        message: Joi.string()
            .max(1000)
            .optional()
            .allow(null, '')
            .trim()
            .messages({
                'string.max': 'Message cannot exceed 1000 characters'
            }),
        status: Joi.string()
            .valid('New', 'In Progress', 'Resolved', 'Closed')
            .optional()
            .messages({
                'any.only': 'Status must be one of: New, In Progress, Resolved, Closed'
            })
    })
};