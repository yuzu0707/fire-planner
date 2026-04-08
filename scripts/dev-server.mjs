import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const port = Number(process.env.PORT || 8080);
const root = process.cwd();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

function safePath(urlPath) {
  const cleanPath = urlPath.split("?")[0].split("#")[0];
  const filePath = cleanPath === "/" ? "/index.html" : cleanPath;
  const normalized = normalize(filePath).replace(/^(\.\.[/\\])+/, "");
  return join(root, normalized);
}

const server = createServer(async (req, res) => {
  try {
    const filePath = safePath(req.url || "/");
    const ext = extname(filePath).toLowerCase();
    const content = await readFile(filePath);

    res.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(content);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not Found");
  }
});

server.listen(port, () => {
  console.log(`FIRE Planner running at http://localhost:${port}`);
});
