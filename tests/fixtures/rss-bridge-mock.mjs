// Stand-in for RSS-Bridge during tests (no network, no Instagram).
//   GET  /                       → 200 (reachability check)
//   GET  /?…&u=<username>        → the feed set for that username, else tests/fixtures/instagram/<username>.xml
//        u=broken_feed           → 500 with an RSS-Bridge-style error page
//        u=not_a_feed            → 200 with an HTML page (invalid feed)
//   POST /__feed/<username>      → body becomes that username's feed (simulates a new post)
import { readFileSync, existsSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "instagram");
const feeds = new Map();
const port = Number(process.env.MOCK_BRIDGE_PORT ?? 3199);

createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
  if (req.method === "POST" && url.pathname.startsWith("/__feed/")) {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      feeds.set(decodeURIComponent(url.pathname.slice("/__feed/".length)), body);
      res.writeHead(204).end();
    });
    return;
  }
  const user = url.searchParams.get("u");
  if (!user) {
    res.writeHead(200, { "Content-Type": "text/html" }).end("<h1>RSS-Bridge (test mock)</h1>");
    return;
  }
  if (user === "broken_feed") {
    res.writeHead(500, { "Content-Type": "text/html" }).end("<h1>Bridge returned error 401! (Unauthorized)</h1>");
    return;
  }
  if (user === "not_a_feed") {
    res.writeHead(200, { "Content-Type": "text/html" }).end("<html><body>Not a feed</body></html>");
    return;
  }
  const file = path.join(dir, `${user.replace(/[^a-z0-9._]/gi, "")}.xml`);
  const body = feeds.get(user) ?? (existsSync(file) ? readFileSync(file, "utf8") : null);
  if (!body) {
    res.writeHead(404, { "Content-Type": "text/html" }).end("<h1>Not found</h1>");
    return;
  }
  res.writeHead(200, { "Content-Type": "application/atom+xml; charset=utf-8" }).end(body);
}).listen(port, "127.0.0.1", () => console.log(`RSS-Bridge mock on ${port}`));
