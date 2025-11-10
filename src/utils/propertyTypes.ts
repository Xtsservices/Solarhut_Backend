import { ResidentialPropertyType, CommercialPropertyType, IndustrialPropertyType } from '../queries/leadQueries';

export const getPropertyTypesBySolarService = (solarService: string): string[] => {
    switch (solarService) {
        case 'Residential Solar':
            return [
                'Independent House',
                'Apartment',
                'Villa',
                'Farmhouse',
                'Others'
            ];
        case 'Commercial Solar':
            return [
                'Office Building',
                'Shop/Showroom',
                'Shopping Mall',
                'Hotel/Resort',
                'Hospital',
                'School/College',
                'Others'
            ];
        case 'Industrial Solar':
            return [
                'Factory',
                'Warehouse',
                'Manufacturing Unit',
                'Processing Plant',
                'Others'
            ];
        default:
            return [];
    }
};

export const validatePropertyTypeForSolarService = (
    propertyType: string,
    solarService: string
): boolean => {
    const validTypes = getPropertyTypesBySolarService(solarService);
    return validTypes.includes(propertyType);
};