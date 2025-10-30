import Joi from 'joi';

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

        home_type: Joi.string()
            .valid('individual', 'agricultural_land', 'villa', 'apartment', 'commercial', 'industrial')
            .required()
            .messages({
                'any.only': 'Invalid home type selected',
                'any.required': 'Home type is required'
            })
    })
};