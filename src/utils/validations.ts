import Joi from 'joi';

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

export const contactSchema = {
    create: Joi.object({
        full_name: Joi.string()
            .min(2)
            .max(100)
            .required()
            .messages({
                'string.min': 'Full name must be at least 2 characters long',
                'string.max': 'Full name cannot exceed 100 characters',
                'string.empty': 'Full name is required',
                'any.required': 'Full name is required'
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
        reason: Joi.string()
            .min(2)
            .max(100)
            .required()
            .messages({
                'string.min': 'Reason must be at least 2 characters long',
                'string.max': 'Reason cannot exceed 100 characters',
                'string.empty': 'Reason is required',
                'any.required': 'Reason is required'
            }),
        message: Joi.string()
            .min(10)
            .max(500)
            .optional()
            .messages({
                'string.min': 'Message must be at least 10 characters long',
                'string.max': 'Message cannot exceed 500 characters'
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

export const roleSchema = {
    create: Joi.object({
        role_name: Joi.string()
            .min(2)
            .max(100)
            .required()
            .trim()
            .pattern(/^[A-Za-z\s]+$/)
            .messages({
                'string.empty': 'Role name is required',
                'string.min': 'Role name must be at least 2 characters long',
                'string.max': 'Role name cannot exceed 100 characters',
                'string.pattern.base': 'Role name can only contain letters and spaces',
                'any.required': 'Role name is required'
            })
    }),
    update: Joi.object({
        role_name: Joi.string()
            .min(2)
            .max(100)
            .required()
            .trim()
            .pattern(/^[A-Za-z\s]+$/)
            .messages({
                'string.empty': 'Role name is required',
                'string.min': 'Role name must be at least 2 characters long',
                'string.max': 'Role name cannot exceed 100 characters',
                'string.pattern.base': 'Role name can only contain letters and spaces',
                'any.required': 'Role name is required'
            })
    }),
    assign: Joi.object({
        employeeId: Joi.number()
            .required()
            .messages({
                'number.base': 'Employee ID must be a number',
                'any.required': 'Employee ID is required'
            }),
        roleId: Joi.number()
            .required()
            .messages({
                'number.base': 'Role ID must be a number',
                'any.required': 'Role ID is required'
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