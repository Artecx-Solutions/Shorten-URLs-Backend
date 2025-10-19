import mongoose, { Schema } from 'mongoose';
import shortid from 'shortid';
import validator from 'validator';

const linkSchema = new Schema({
  originalUrl: {
    type: String,
    required: [true, 'Original URL is required'],
    validate: {
      validator: (v: string) =>
        validator.isURL(v, {
          protocols: ['http', 'https'],
          require_tld: true,
          require_protocol: true
        }),
      message: 'Invalid URL format. Must include http:// or https://'
    }
  },
  shortCode: {
    type: String,
    required: true,
    unique: true,
    default: shortid.generate,
    match: [/^[a-zA-Z0-9_-]+$/, 'Short code can only contain letters, numbers, underscores, and hyphens']
  },
  customAlias: {
    type: String,
    sparse: true,
    match: [/^[a-zA-Z0-9_-]+$/, 'Custom alias can only contain letters, numbers, underscores, and hyphens']
  },
  clicks: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  createdBy: { type: String, default: 'anonymous' }, // NOTE: your controller sometimes sets null; either allow { type: String, default: null } or keep 'anonymous'
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
  },
  isActive: { type: Boolean, default: true }
});

// Indexes
linkSchema.index({ shortCode: 1, isActive: 1 });
linkSchema.index({ createdAt: -1 });
linkSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Export types inferred from the schema
export type LinkDoc = mongoose.InferSchemaType<typeof linkSchema> & { _id: mongoose.Types.ObjectId };
export const Link = mongoose.model<LinkDoc>('Link', linkSchema);