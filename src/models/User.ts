import { Schema, model } from 'mongoose';

export type Role = 'admin' | 'manager' | 'user';

interface IUser {
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  tokenVersion: number;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['admin', 'manager', 'user'], default: 'user', index: true },
    tokenVersion: { type: Number, default: 0 }
  },
  { timestamps: true }
);

export const User = model<IUser>('User', UserSchema);
export type UserDocument = InstanceType<typeof User>;