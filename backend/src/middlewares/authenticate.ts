import { jwtSecret } from "../secret";
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export function authenticateWithBearer() {
  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("Missing or invalid bearer header");
      res.status(401).json({ message: "Missing or invalid bearer header" });
      return;
    }
    const token = authHeader.split(" ")[1];
    try {
      const payload = jwt.verify(token, jwtSecret());
      res.locals.user = payload;
      next();
    } catch {
      res.status(401).json({ message: "Invalid or expired token" });
      return;
    }
  };
}
