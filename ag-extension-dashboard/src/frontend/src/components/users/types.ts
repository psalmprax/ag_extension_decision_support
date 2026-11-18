export interface DirectoryUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  region: string;
  country?: string;
  phone: string;
  lastLogin?: string | null;
  isDemo?: boolean;
}
