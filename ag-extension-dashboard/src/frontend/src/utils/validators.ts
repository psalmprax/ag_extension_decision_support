import DOMPurify from 'dompurify';

export const isValidEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export const isValidPhone = (phone: string): boolean => {
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length >= 10 && cleaned.length <= 15;
};

export const isNotEmpty = (value: string): boolean => {
    return value.trim().length > 0;
};

export const minLength = (value: string, min: number): boolean => {
    return value.length >= min;
};

export const maxLength = (value: string, max: number): boolean => {
    return value.length <= max;
};

export const isPositiveNumber = (value: number): boolean => {
    return !Number.isNaN(value) && value > 0;
};

export const isInRange = (value: number, min: number, max: number): boolean => {
    return !Number.isNaN(value) && value >= min && value <= max;
};

export const sanitizeHtml = (str: string): string => {
    return DOMPurify.sanitize(str);
};

export const escapeHtml = (str: string): string => {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

export const escapeRegex = (str: string): string => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
};
