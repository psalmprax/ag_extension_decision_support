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
    return !isNaN(value) && value > 0;
};

export const isInRange = (value: number, min: number, max: number): boolean => {
    return !isNaN(value) && value >= min && value <= max;
};

export const sanitizeHtml = (str: string): string => {
    // Use textContent → innerHTML round-trip for safe escaping
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
};

export const escapeRegex = (str: string): string => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};
