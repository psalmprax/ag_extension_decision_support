import client from './client';

export interface Language {
    code: string;
    name: string;
    flag: string;
    nativeName: string;
}

export interface LanguageResponse {
    success: boolean;
    data: {
        languages: Language[];
        defaultLanguage: string;
        total: number;
    };
}

export interface AISupportedLanguage {
    code: string;
    name: string;
}

export interface AISupportedResponse {
    success: boolean;
    data: {
        languages: AISupportedLanguage[];
        defaultLanguage: string;
    };
}

// Get all supported languages
export const getLanguages = async (): Promise<LanguageResponse> => {
    const response = await client.get<LanguageResponse>('/language');
    return response.data;
};

// Get languages supported by AI chatbot
export const getAISupportedLanguages = async (): Promise<AISupportedResponse> => {
    const response = await client.get<AISupportedResponse>('/language/ai-supported');
    return response.data;
};

// Get specific language by code
export const getLanguage = async (code: string): Promise<Language> => {
    const response = await client.get<{ success: boolean; data: Language }>(`/language/${code}`);
    return response.data.data;
};

export default {
    getLanguages,
    getAISupportedLanguages,
    getLanguage,
};
