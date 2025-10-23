// export interface CreateLinkRequest {
//   originalUrl: string;
//   customAlias?: string;
//   title?: string;
//   description?: string;
// }

// export interface CreateLinkResponse {
//   shortUrl: string;
//   originalUrl: string;
//   shortCode: string;
//   clicks: number;
//   message?: string;
// }

// export interface LinkAnalytics {
//   originalUrl: string;
//   shortCode: string;
//   clicks: number;
//   createdAt: Date;
//   isActive: boolean;
// }

export interface CreateLinkRequest {
  originalUrl: string;
  customAlias?: string;
  title?: string;
  description?: string;
  password?: string;     // <-- NEW (optional)
  expiryDate?: string;   // <-- NEW (ISO date string, optional; max 5 days ahead)
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
