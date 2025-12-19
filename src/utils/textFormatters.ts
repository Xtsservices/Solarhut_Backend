/**
 * Text Formatting Utility Functions
 * These functions can be used globally across the application
 */

/**
 * Converts a string to Title Case (first letter of each word capitalized)
 * @param str - The string to convert
 * @returns The string in Title Case format
 * @example toTitleCase('hello world') => 'Hello World'
 * @example toTitleCase('JOHN DOE') => 'John Doe'
 */
export const toTitleCase = (str: string | null | undefined): string => {
    if (!str) return '';
    return str
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

/**
 * Converts a string to UPPER CASE
 * @param str - The string to convert
 * @returns The string in UPPER CASE format
 */
export const toUpperCase = (str: string | null | undefined): string => {
    if (!str) return '';
    return str.toUpperCase();
};

/**
 * Converts a string to lower case
 * @param str - The string to convert
 * @returns The string in lower case format
 */
export const toLowerCase = (str: string | null | undefined): string => {
    if (!str) return '';
    return str.toLowerCase();
};

/**
 * Converts a string to Sentence case (first letter of first word capitalized)
 * @param str - The string to convert
 * @returns The string in Sentence case format
 * @example toSentenceCase('hello world') => 'Hello world'
 */
export const toSentenceCase = (str: string | null | undefined): string => {
    if (!str) return '';
    const lower = str.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
};

/**
 * Capitalizes first letter only, keeps rest unchanged
 * @param str - The string to convert
 * @returns The string with first letter capitalized
 */
export const capitalizeFirst = (str: string | null | undefined): string => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
};

/**
 * Truncates a string to a specified length and adds ellipsis
 * @param str - The string to truncate
 * @param maxLength - Maximum length before truncation
 * @returns The truncated string with ellipsis if needed
 */
export const truncateText = (str: string | null | undefined, maxLength: number): string => {
    if (!str) return '';
    if (str.length <= maxLength) return str;
    return str.slice(0, maxLength - 3) + '...';
};

/**
 * Removes extra whitespace from a string
 * @param str - The string to clean
 * @returns The string with extra whitespace removed
 */
export const cleanWhitespace = (str: string | null | undefined): string => {
    if (!str) return '';
    return str.replace(/\s+/g, ' ').trim();
};
