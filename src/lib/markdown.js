import fs from "node:fs";
import path from "node:path";
import md from "markdown-it";
import footnote from "markdown-it-footnote";

const BLOG_ROOT = path.resolve(import.meta.dir, "../content/blog");

let mdLib = md({
  html: false,
  linkify: true,
  typographer: true,
}).use(footnote);

// Parse a simple YAML frontmatter block (title/description/etc.).
function parseFrontmatter(raw) {
  if (!raw.startsWith("---")) return { meta: {}, body: raw };

  let end = raw.indexOf("\n---", 4);

  if (end === -1) return { meta: {}, body: raw };

  let block = raw.slice(4, end);
  let body = raw.slice(end + 4);
  let meta = {};

  for (let line of block.split("\n")) {
    if (!line.includes(":")) continue;

    let i = line.indexOf(":");
    let key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim();
    // strip a leading/trailing matching quote pair
    if (val.length >= 2 && val[0] === "'" && val[val.length - 1] === "'") {
      val = val.slice(1, -1);
    } else if (
      val.length >= 2 &&
      val[0] === '"' &&
      val[val.length - 1] === '"'
    ) {
      val = val.slice(1, -1);
    }

    meta[key] = val;
  }

  return { meta, body };
}

export function loadPost(slug) {
  let file = path.join(BLOG_ROOT, `${slug}.md`);

  if (!fs.existsSync(file)) {
    return null;
  }

  let { meta, body } = parseFrontmatter(fs.readFileSync(file, "utf8"));

  return {
    slug,
    meta,
    html: mdLib.render(body),
  };
}

export function loadAllPosts() {
  let names = fs.readdirSync(BLOG_ROOT).filter((n) => n.endsWith(".md"));
  let posts = names
    .map((n) => {
      let slug = n.replace(/\.md$/, "");
      let { meta, body } = parseFrontmatter(
        fs.readFileSync(path.join(BLOG_ROOT, n), "utf8"),
      );

      return { slug, meta, html: mdLib.render(body) };
    })
    .filter((p) => p.meta.publishDate)
    .sort((a, b) =>
      (b.meta.publishDate || "").localeCompare(a.meta.publishDate || ""),
    );

  return posts;
}

export function formatDate(iso) {
  if (!iso) return "";

  let d = new Date(iso);

  if (Number.isNaN(d.getTime())) return iso;

  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
