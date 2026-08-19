import apiClient from './client';

export interface ChannelItemConfig {
  channel: 'sms' | 'whatsapp' | 'telegram';
  provider: string;
  isEnabled: boolean;
  autoOnboarding: boolean;
  welcomeTemplate?: string | null;
  config: Record<string, string>;
  webhookUrl: string;
}

export interface ChannelConfigsMap {
  sms: ChannelItemConfig;
  whatsapp: ChannelItemConfig;
  telegram: ChannelItemConfig;
}

export interface ChannelConfigResponse {
  success: boolean;
  data: ChannelConfigsMap;
  stats: {
    sms: number;
    whatsapp: number;
    telegram: number;
  };
}

export interface UpdateChannelConfigPayload {
  channel: 'sms' | 'whatsapp' | 'telegram';
  provider?: string;
  isEnabled: boolean;
  autoOnboarding?: boolean;
  welcomeTemplate?: string;
  config: Record<string, string>;
}

export interface TestChannelPayload {
  channel: 'sms' | 'whatsapp' | 'telegram';
  recipient?: string;
  message?: string;
  botToken?: string;
}

export interface ChannelTestResponse {
  success: boolean;
  bot?: {
    id: number;
    first_name: string;
    username: string;
  };
  status?: string;
  error?: string;
}

export const fetchChannelConfigs = async (): Promise<ChannelConfigResponse> => {
  const response = await apiClient.get<ChannelConfigResponse>('/channels/config');
  return response.data;
};

export const updateChannelConfig = async (payload: UpdateChannelConfigPayload) => {
  const response = await apiClient.patch('/channels/config', payload);
  return response.data;
};

export const testChannelDispatch = async (payload: TestChannelPayload): Promise<ChannelTestResponse> => {
  const response = await apiClient.post<ChannelTestResponse>('/channels/test', payload);
  return response.data;
};
