export function detectEvidenceMime(buffer) {
  if (buffer?.[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer?.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buffer?.subarray(0, 5).toString("ascii") === "%PDF-") return "application/pdf";
  if (buffer?.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return null;
}

export function isCompleteEvidence(buffer, mimeType) {
  if (mimeType === "image/jpeg") return buffer.length >= 4 && buffer.lastIndexOf(Buffer.from([0xff, 0xd9])) >= 2;
  if (mimeType === "image/png") return buffer.length >= 20 && buffer.subarray(buffer.length - 8, buffer.length - 4).toString("ascii") === "IEND";
  if (mimeType === "application/pdf") return buffer.length >= 12 && buffer.subarray(Math.max(0, buffer.length - 2048)).toString("latin1").includes("%%EOF");
  if (mimeType === "image/webp") return buffer.length >= 16 && buffer.readUInt32LE(4) + 8 <= buffer.length;
  return false;
}
