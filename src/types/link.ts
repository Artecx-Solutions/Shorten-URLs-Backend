export interface CreateLinkRequest {
  originalUrl: string;
  customAlias?: string;
  title?: string;
  description?: string;
}

export interface CreateLinkResponse {
  shortUrl: string;
  originalUrl: string;
  shortCode: string;
  clicks: number;
  message?: string;
}

export interface LinkAnalytics {
  originalUrl: string;
  shortCode: string;
  clicks: number;
  createdAt: Date;
  isActive: boolean;
}