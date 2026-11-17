import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const configDirectory = path.dirname(fileURLToPath(import.meta.url));
export const uploadsDirectory = path.resolve(process.env.UPLOADS_DIR || path.resolve(configDirectory, "../../uploads"));
fs.mkdirSync(uploadsDirectory, { recursive: true });

export function uploadPathFor(...parts) {
  const candidate = path.resolve(uploadsDirectory, ...parts);
  if (!candidate.startsWith(`${uploadsDirectory}${path.sep}`)) throw new Error("Invalid upload path.");
  return candidate;
}

export function filePathFromUploadReference(reference) {
  const value = String(reference || "");
  const relative = value.replace(/^\/?uploads\//, "");
  if (!relative || path.isAbsolute(relative)) return null;
  const candidate = path.resolve(uploadsDirectory, relative);
  if (!candidate.startsWith(`${uploadsDirectory}${path.sep}`)) return null;
  return candidate;
}
