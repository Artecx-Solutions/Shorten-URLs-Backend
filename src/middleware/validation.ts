import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

export const createLinkSchema = z.object({
  originalUrl: z.string().url('Invalid URL format'),
  customAlias: z.string().optional().refine(
    (val) => !val || /^[a-zA-Z0-9_-]+$/.test(val),
    'Custom alias can only contain letters, numbers, underscores, and hyphens'
  )
});

export const validateCreateLink = (req: Request, res: Response, next: NextFunction): void => {
  try {
    createLinkSchema.parse(req.body);
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      });
      return;
    }
    next(error);
  }
};