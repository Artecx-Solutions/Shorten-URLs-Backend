import { Schema, model } from 'mongoose';

export interface PageMetaDoc {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  keywords?: string;
  siteName?: string;
  fetchedAt: Date;
}

const PageMetaSchema = new Schema<PageMetaDoc>(
  {
    url: { type: String, required: true, unique: true, index: true },
    title: String,
    description: String,
    image: String,
    keywords: String,
    siteName: String,
    fetchedAt: { type: Date, default: () => new Date(), index: true }
  },
  { timestamps: true }
);

PageMetaSchema.index({ fetchedAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

export const PageMeta = model<PageMetaDoc>('PageMeta', PageMetaSchema);