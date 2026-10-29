import jwt from "jsonwebtoken";
import { findUserById } from "../models/userModel.js";
import { isMaintenanceMode } from "../../models/systemSettingModel.js";

export async function authenticate(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ message: "Authentication is required." });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await findUserById(decoded.sub);
    if (!user || !user.is_active) return res.status(401).json({ message: "Account is unavailable." });
    if (user.role !== "admin" && await isMaintenanceMode()) return res.status(503).json({ message: "AgriSystem is temporarily in maintenance mode. Please try again later." });
    req.user = user;
    next();
  } catch { return res.status(401).json({ message: "Your session is invalid or expired." }); }
}

export function allowRoles(...roles) {
  return (req, res, next) => roles.includes(req.user.role)
    ? next()
    : res.status(403).json({ message: "You do not have permission for this action." });
}
