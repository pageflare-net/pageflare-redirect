import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";

export function validateParams(schema: ZodSchema<Record<string, unknown>>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      res.status(400).json({
        message: "Invalid URL parameters",
        errors: result.error.errors,
      });
      return;
    }
    Object.assign(req.params, result.data);
    next();
  };
}

export function validateQuery(schema: ZodSchema<Record<string, unknown>>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      res.status(400).json({
        message: "Invalid query parameters",
        errors: result.error.errors,
      });
      return;
    }
    Object.assign(req.query, result.data);
    next();
  };
}

export function validateBody(schema: ZodSchema<Record<string, unknown>>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        message: "Invalid request body",
        errors: result.error.errors,
      });
      return;
    }
    req.body = result.data;
    next();
  };
}
