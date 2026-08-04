#!/usr/bin/env node
/**
 * Tiny static server for previewing dist/ locally. Dependency-free.
 * Resolves /girls/ to /girls/index.html the same way Netlify does.
 *
 *   npm start          build, then serve on http://localhost:8080
 *   PORT=3000 npm run serve
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

const DIST = path.join(__dirname, "..", "dist");
const PORT = Number(process.env.PORT || 8080);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".yml": "text/yaml; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8"
};

if (!fs.existsSync(DIST)) {
  console.error("dist/ does not exist yet — run `npm run build` first.");
  process.exit(1);
}

http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split("?")[0]);
  if (rel.endsWith("/")) rel += "index.html";

  // Keep every request inside dist/
  const file = path.join(DIST, path.normalize(rel).replace(/^(\.\.[/\\])+/, ""));
  if (!file.startsWith(DIST)) {
    res.writeHead(403).end("Forbidden");
    return;
  }

  fs.readFile(file, (err, body) => {
    if (err) {
      // /admin/anything → the admin shell, matching the Netlify redirect
      if (rel.startsWith("/admin/")) {
        const shell = path.join(DIST, "admin", "index.html");
        if (fs.existsSync(shell)) {
          res.writeHead(200, { "Content-Type": TYPES[".html"] });
          res.end(fs.readFileSync(shell));
          return;
        }
      }
      res.writeHead(404, { "Content-Type": TYPES[".html"] });
      res.end("<h1>404</h1><p>Not found: " + rel + "</p>");
      return;
    }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
    res.end(body);
  });
}).listen(PORT, () => {
  console.log("Serving dist/ on http://localhost:" + PORT);
  console.log("Admin at        http://localhost:" + PORT + "/admin/");
  console.log("(for the admin to save locally, run `npm run cms` in a second terminal)");
});
