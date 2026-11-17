import rateLimit from "express-rate-limit";
// Express derives req.ip from the socket by default; forwarded headers are not trusted.
export const globalRateLimiter = rateLimit({
  windowMs: 600000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});
export const loginRateLimiter = rateLimit({
  windowMs: 900000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});
