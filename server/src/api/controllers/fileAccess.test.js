import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import express from "express";
import jwt from "jsonwebtoken";

const testDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "agrisystem-file-access-"));
process.env.UPLOADS_DIR = testDirectory;
process.env.JWT_SECRET = "file-access-test-secret";

const [{ pool }, { default: fileRoutes }, { default: adminRoutes }, { validateUploadedEvidence }] = await Promise.all([
  import("../../config/db.js"),
  import("../routes/fileRoutes.js"),
  import("../routes/adminRoutes.js"),
  import("../middleware/upload.js"),
]);

const users = {
  "10": { id: 10, full_name: "Farmer One", role: "farmer", is_active: 1 },
  "12": { id: 12, full_name: "Farmer Two", role: "farmer", is_active: 1 },
  "20": { id: 20, full_name: "MAO Staff", role: "staff", is_active: 1 },
  "30": { id: 30, full_name: "MAO Admin", role: "admin", is_active: 1 },
};
const records = { land: null, attachment: null };
const originalProofReference = "uploads/land-title.pdf";
let originalPoolQuery;
let server;
let baseUrl;

const app = express();
app.use(express.json());
app.use("/api/files", fileRoutes);
app.use("/api/admin", adminRoutes);
app.use((error, _req, res, _next) => res.status(500).json({ message: error.message }));

function tokenFor(id) { return jwt.sign({ sub: id }, process.env.JWT_SECRET); }
function headersFor(id) { return { Authorization: `Bearer ${tokenFor(id)}` }; }

before(async () => {
  originalPoolQuery = pool.query;
  pool.query = async (sql, values = []) => {
    if (sql.includes("FROM users WHERE id = ?")) return [[users[String(values[0])]].filter(Boolean), []];
    if (sql.includes("FROM system_settings WHERE setting_key = 'maintenance_mode'")) return [[], []];
    if (sql.includes("FROM lands l JOIN farmer_profiles")) return [[records.land].filter(Boolean), []];
    if (sql.includes("FROM report_photos rp JOIN damage_reports")) return [[records.attachment].filter(Boolean), []];
    if (sql.startsWith("UPDATE lands SET ownership_proof_status")) {
      if (!records.land?.file_reference) return [{ affectedRows: 0 }, []];
      records.land.review_status = values[0];
      return [{ affectedRows: 1 }, []];
    }
    if (sql.includes("INSERT INTO admin_audit_logs") && sql.includes("land.document_reviewed")) return [{ affectedRows: 1 }, []];
    throw new Error(`Unexpected test database query: ${sql}`);
  };
  await fs.writeFile(path.join(testDirectory, "land-title.pdf"), Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n"));
  await fs.writeFile(path.join(testDirectory, "report-image.png"), Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(8), Buffer.from("IEND"), Buffer.alloc(4),
  ]));
  await fs.writeFile(path.join(testDirectory, "broken.pdf"), Buffer.from("%PDF-1.4\ntruncated"));
  await fs.writeFile(path.join(testDirectory, "valid.jpg"), Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x00, 0xff, 0xd9]));
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  pool.query = originalPoolQuery;
  for (const name of ["land-title.pdf", "report-image.png", "broken.pdf", "valid.jpg", "invalid.pdf"]) await fs.unlink(path.join(testDirectory, name)).catch(() => {});
  await fs.rmdir(testDirectory);
});

test("file routes require a valid session and limit farmers to their own land document", async () => {
  records.land = { file_reference: "uploads/land-title.pdf", mime_type: "application/pdf", original_name: "My land title.pdf", user_id: 10 };
  const url = `${baseUrl}/api/files/lands/4/ownership-proof`;
  const anonymous = await fetch(url);
  assert.equal(anonymous.status, 401);
  const otherFarmer = await fetch(url, { headers: headersFor(12) });
  assert.equal(otherFarmer.status, 403);
  const owner = await fetch(url, { headers: headersFor(10) });
  assert.equal(owner.status, 200);
  assert.match(owner.headers.get("content-type"), /application\/pdf/);
  assert.equal(owner.headers.get("cache-control"), "private, no-store");
  assert.match(owner.headers.get("content-disposition"), /^inline;/);
  assert.match(await owner.text(), /%%EOF/);
});

test("staff can preview and download authorized files; missing and corrupt files return clear errors", async () => {
  records.land = { file_reference: "uploads/land-title.pdf", mime_type: "application/pdf", original_name: "My land title.pdf", user_id: 10 };
  const staff = headersFor(20);
  const download = await fetch(`${baseUrl}/api/files/lands/4/ownership-proof?download=1`, { headers: staff });
  assert.equal(download.status, 200);
  assert.match(download.headers.get("content-disposition"), /^attachment;/);

  records.land.file_reference = "uploads/not-present.pdf";
  const missing = await fetch(`${baseUrl}/api/files/lands/4/ownership-proof`, { headers: staff });
  assert.equal(missing.status, 404);
  assert.match((await missing.json()).message, /missing from storage/i);

  records.land.file_reference = "uploads/broken.pdf";
  const corrupt = await fetch(`${baseUrl}/api/files/lands/4/ownership-proof`, { headers: staff });
  assert.equal(corrupt.status, 422);
  assert.match((await corrupt.json()).message, /damaged or incomplete/i);

  records.land.file_reference = "../outside.pdf";
  const traversal = await fetch(`${baseUrl}/api/files/lands/4/ownership-proof`, { headers: staff });
  assert.equal(traversal.status, 404);
});

test("staff can view a report attachment while another farmer is denied", async () => {
  records.attachment = { file_reference: "uploads/report-image.png", mime_type: "image/png", original_name: "field.png", user_id: 10 };
  const url = `${baseUrl}/api/files/reports/8/attachments/3`;
  assert.equal((await fetch(url, { headers: headersFor(12) })).status, 403);
  const response = await fetch(url, { headers: headersFor(30) });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /image\/png/);
});

test("staff can update document verification without changing the uploaded file reference", async () => {
  records.land = { file_reference: originalProofReference, mime_type: "application/pdf", original_name: "My land title.pdf", user_id: 10 };
  const response = await fetch(`${baseUrl}/api/admin/lands/4/document-review`, {
    method: "PATCH",
    headers: { ...headersFor(20), "Content-Type": "application/json" },
    body: JSON.stringify({ status: "verified", remarks: "Title checked" }),
  });
  assert.equal(response.status, 200);
  assert.equal(records.land.review_status, "verified");
  assert.equal(records.land.file_reference, originalProofReference);
});

test("upload validation accepts complete JPG and PDF content and removes truncated files", async () => {
  async function validate(file) {
    const response = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    let nextCalled = false;
    await validateUploadedEvidence({ files: [file] }, response, error => { if (error) throw error; nextCalled = true; });
    return { response, nextCalled };
  }
  const jpg = path.join(testDirectory, "valid.jpg");
  const goodJpg = await validate({ path: jpg, fieldname: "ownershipProof", mimetype: "image/jpeg", originalname: "land.jpg" });
  assert.equal(goodJpg.nextCalled, true);
  assert.equal(goodJpg.response.statusCode, 200);

  const pdf = path.join(testDirectory, "land-title.pdf");
  const goodPdf = await validate({ path: pdf, fieldname: "ownershipProof", mimetype: "application/pdf", originalname: "title.pdf" });
  assert.equal(goodPdf.nextCalled, true);

  const invalid = path.join(testDirectory, "invalid.pdf");
  await fs.writeFile(invalid, Buffer.from("%PDF-1.4\ntruncated"));
  const badPdf = await validate({ path: invalid, fieldname: "ownershipProof", mimetype: "application/pdf", originalname: "title.pdf" });
  assert.equal(badPdf.response.statusCode, 422);
  assert.equal(badPdf.nextCalled, false);
  await assert.rejects(fs.access(invalid), { code: "ENOENT" });
});
