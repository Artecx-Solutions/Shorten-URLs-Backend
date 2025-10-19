// models/Link.ts
import mongoose, { Document, Schema } from 'mongoose';
import validator from 'validator';

export interface ILinkDocument extends Document {
  originalUrl: string;
  shortCode: string;
  customAlias?: string;
  clicks: number;
  createdAt: Date;
  createdBy: mongoose.Types.ObjectId | string | null; // Allow string, ObjectId, or null
  expiresAt: Date;
  isActive: boolean;
  title?: string;
  description?: string;
}

const linkSchema = new Schema<ILinkDocument>({
  originalUrl: {
    type: String,
    required: [true, 'Original URL is required'],
    validate: {
      validator: (v: string) => validator.isURL(v, {
        protocols: ['http','https'],
        require_tld: true,
        require_protocol: true,
      }),
      message: 'Invalid URL format. Must include http:// or https://'
    }
  },
  shortCode: {
    type: String,
    required: true,
    unique: true
  },
  customAlias: {
    type: String,
    sparse: true
  },
  clicks: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
   createdBy: {
    type: Schema.Types.Mixed, // Change to Mixed to handle both ObjectId and string
    ref: 'User',
    required: true
  }, 
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year from now
  },
  isActive: {
    type: Boolean,
    default: true
  },
  title: {
    type: String,
    maxlength: [100, 'Title cannot be more than 100 characters']
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot be more than 500 characters']
  }
});

// Indexes
linkSchema.index({ shortCode: 1 });
linkSchema.index({ createdAt: -1 });
linkSchema.index({ createdBy: 1, createdAt: -1 });

export const Link = mongoose.model<ILinkDocument>('Link', linkSchema);