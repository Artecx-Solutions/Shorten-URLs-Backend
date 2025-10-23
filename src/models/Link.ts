// import { Schema, model, Types } from 'mongoose';

// export interface LinkDoc {
//   _id: Types.ObjectId;
//   originalUrl: string;
//   shortCode: string;
//   customAlias?: string;
//   clicks: number;
//   createdAt: Date;
//   createdBy: Types.ObjectId | null;
//   expiresAt: Date;
//   isActive: boolean;
//   title?: string;
//   description?: string;
// }

// const LinkSchema = new Schema<LinkDoc>(
//   {
//     originalUrl: { type: String, required: true, trim: true },
//     shortCode: { type: String, required: true, unique: true, index: true },
//     customAlias: { type: String, trim: true },
//     clicks: { type: Number, default: 0 },
//     createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
//     expiresAt: { type: Date, required: true, index: true },
//     isActive: { type: Boolean, default: true, index: true },
//     title: { type: String, trim: true },
//     description: { type: String, trim: true }
//   },
//   { timestamps: true }
// );

// export const Link = model<LinkDoc>('Link', LinkSchema);

import { Schema, model, Types } from 'mongoose';

export interface LinkDoc {
  _id: Types.ObjectId;
  originalUrl: string;
  shortCode: string;
  customAlias?: string;
  clicks: number;
  createdAt: Date;
  createdBy: Types.ObjectId | null;
  expiresAt: Date;
  isActive: boolean;
  title?: string;
  description?: string;
  passwordHash?: string; // <-- NEW
}

const LinkSchema = new Schema<LinkDoc>(
  {
    originalUrl: { type: String, required: true, trim: true },
    shortCode: { type: String, required: true, unique: true, index: true },
    customAlias: { type: String, trim: true },
    clicks: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    expiresAt: { type: Date, required: true, index: true },
    isActive: { type: Boolean, default: true, index: true },
    title: { type: String, trim: true },
    description: { type: String, trim: true },
    passwordHash: { type: String, select: false } // <-- NEW (not selected by default)
  },
  { timestamps: true }
);

export const Link = model<LinkDoc>('Link', LinkSchema);
