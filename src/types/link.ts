export interface ILink {
  _id?: string;
  originalUrl: string;
  shortCode: string;
  customAlias?: string;
  clicks: number;
  createdAt: Date;
  createdBy: string;
  expiresAt: Date;
  isActive: boolean;
}

export interface CreateLinkRequest {
  originalUrl: string;
  customAlias?: string;
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
  metadata?: {
    title?: string;
    description?: string;
    keywords?: string;
    image?: string;
  };
}