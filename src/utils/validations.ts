export interface ValidationError {
    field: string;
    message: string;
}

export class ValidationResult {
    private errors: ValidationError[] = [];

    addError(field: string, message: string) {
        this.errors.push({ field, message });
    }

    hasErrors(): boolean {
        return this.errors.length > 0;
    }

    getErrors(): ValidationError[] {
        return this.errors;
    }
}

export const validations = {
    // First name validation: Alphabets only, 2-50 chars
    isValidName(name: string): boolean {
        const nameRegex = /^[A-Za-z]{2,50}$/;
        return nameRegex.test(name);
    },

    // Mobile validation: 10-digit (India) or international E.164 format
    isValidMobile(mobile: string): boolean {
        // Indian format: 10 digits starting with 6-9
        const indianMobileRegex = /^[6-9]\d{9}$/;
        // International format: E.164 (+ followed by 7-15 digits)
        const internationalMobileRegex = /^\+\d{7,15}$/;
        
        return indianMobileRegex.test(mobile) || internationalMobileRegex.test(mobile);
    },

    // Email validation (optional)
    isValidEmail(email: string | null): boolean {
        if (!email) return true; // Email is optional
        const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return emailRegex.test(email);
    },

    // Service type validation
    isValidServiceType(serviceType: string): boolean {
        return ['Installation', 'Maintenance'].includes(serviceType);
    },

    // Capacity validation (e.g., "2 Tons", "10 KW")
    isValidCapacity(capacity: string): boolean {
        // Matches patterns like "2 Tons", "10 KW", "5.5 KVA", etc.
        const capacityRegex = /^\d+(\.\d+)?\s*(Tons?|KW|KVA|MW|W)$/i;
        return capacityRegex.test(capacity);
    },

    // Message validation (5-500 chars)
    isValidMessage(message: string): boolean {
        return message.length >= 5 && message.length <= 500;
    },

    // Location validation (not empty)
    isValidLocation(location: string): boolean {
        return location.trim().length > 0;
    },

    // Home type validation
    isValidHomeType(homeType: string): boolean {
        const validHomeTypes = [
            'individual',
            'agricultural land',
            'villa',
            'apartment',
            'commercial',
            'industrial'
        ];
        return validHomeTypes.includes(homeType.toLowerCase());
    }
};