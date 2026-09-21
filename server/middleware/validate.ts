import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

function formatZodErrors(err: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of err.issues) {
    const field = issue.path.join('.') || 'root';
    if (!fields[field]) {
      fields[field] = issue.message;
    }
  }
  return fields;
}

/**
 * Express middleware to validate request body using Zod
 */
export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const fields = formatZodErrors(err);
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: Object.values(fields)[0] || 'Invalid request body.',
            fields,
          },
        });
        return;
      }
      next(err);
    }
  };
}

/**
 * Express middleware to validate query parameters using Zod
 */
export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.query = schema.parse(req.query);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const fields = formatZodErrors(err);
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: Object.values(fields)[0] || 'Invalid query parameters.',
            fields,
          },
        });
        return;
      }
      next(err);
    }
  };
}

/**
 * Express middleware to validate route params using Zod
 */
export function validateParams(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.params = schema.parse(req.params);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const fields = formatZodErrors(err);
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: Object.values(fields)[0] || 'Invalid path parameters.',
            fields,
          },
        });
        return;
      }
      next(err);
    }
  };
}
