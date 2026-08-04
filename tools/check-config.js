#!/usr/bin/env node
/**
 * Guards against Decap's sharpest edge: when the CMS saves an entry it writes
 * back ONLY the fields declared in config.yml. Any key present in the JSON but
 * missing from the config is silently dropped the first time an admin hits
 * Save — losing content with no error anywhere.
 *
 * This walks every content file against its collection's field list and fails
 * the build if the two have drifted apart.
 *
 *   npm run check
 *
 * Uses a small hand-rolled YAML reader for the subset config.yml needs, so the
 * project stays dependency-free.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const CONFIG = path.join(ROOT, "site", "admin", "config.yml");

/* --- minimal YAML ------------------------------------------------------- */
/* Handles the subset used by config.yml: nested maps, block sequences, inline
   {a: b} maps, [a, b] flow sequences, quoted scalars, anchors and aliases. */

function parseYaml(src) {
  const lines = src.split("\n")
    .map(l => l.replace(/\t/g, "  "))
    .filter(l => l.trim() && !/^\s*#/.test(l));

  const anchors = {};
  let pos = 0;

  const indentOf = l => l.match(/^ */)[0].length;

  function scalar(raw) {
    let v = raw.trim();
    if (!v) return "";
    if (v.startsWith(">") || v.startsWith("|")) return "";
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      return v.slice(1, -1);
    }
    if (v.startsWith("[") && v.endsWith("]")) {
      return v.slice(1, -1).split(",").map(s => scalar(s)).filter(s => s !== "");
    }
    if (v.startsWith("{") && v.endsWith("}")) {
      const out = {};
      // split on commas that are not inside quotes or brackets
      let depth = 0, quote = null, buf = "";
      const parts = [];
      for (const ch of v.slice(1, -1)) {
        if (quote) { if (ch === quote) quote = null; buf += ch; continue; }
        if (ch === '"' || ch === "'") { quote = ch; buf += ch; continue; }
        if (ch === "[" || ch === "{") depth++;
        if (ch === "]" || ch === "}") depth--;
        if (ch === "," && depth === 0) { parts.push(buf); buf = ""; continue; }
        buf += ch;
      }
      if (buf.trim()) parts.push(buf);
      for (const p of parts) {
        const i = p.indexOf(":");
        if (i === -1) continue;
        out[p.slice(0, i).trim()] = scalar(p.slice(i + 1));
      }
      return out;
    }
    if (v === "true") return true;
    if (v === "false") return false;
    if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
    return v;
  }

  function parseBlock(indent) {
    // sequence?
    if (pos < lines.length && indentOf(lines[pos]) === indent && /^\s*-\s/.test(lines[pos])) {
      const arr = [];
      while (pos < lines.length && indentOf(lines[pos]) === indent && /^\s*-\s*/.test(lines[pos])) {
        const line = lines[pos];
        const rest = line.slice(indent + 1).replace(/^\s*/, "");
        pos++;
        if (!rest) {
          arr.push(parseBlock(indent + 2));
        } else if (/^[\w"'-]+\s*:/.test(rest) && !rest.startsWith("{")) {
          // inline first key of a map item: re-read as a map starting here
          const childIndent = line.indexOf(rest);
          lines.splice(pos, 0, " ".repeat(childIndent) + rest);
          arr.push(parseMap(childIndent));
        } else {
          arr.push(scalar(rest));
        }
      }
      return arr;
    }
    return parseMap(indent);
  }

  function parseMap(indent) {
    const map = {};
    while (pos < lines.length) {
      const line = lines[pos];
      const ind = indentOf(line);
      if (ind < indent) break;
      if (ind > indent) { pos++; continue; }
      if (/^\s*-\s/.test(line)) break;

      const m = line.slice(indent).match(/^([\w"'.-]+)\s*:\s*(.*)$/);
      if (!m) { pos++; continue; }
      let key = m[1].replace(/^["']|["']$/g, "");
      let rest = m[2];
      pos++;

      // anchor / alias
      let anchorName = null;
      const anchorMatch = rest.match(/^&(\S+)\s*(.*)$/);
      if (anchorMatch) { anchorName = anchorMatch[1]; rest = anchorMatch[2]; }
      const aliasMatch = rest.match(/^\*(\S+)$/);
      if (aliasMatch) {
        map[key] = anchors[aliasMatch[1]];
        continue;
      }

      let value;
      if (rest === "" || rest.startsWith(">") || rest.startsWith("|")) {
        // block scalar or nested block
        const nextInd = pos < lines.length ? indentOf(lines[pos]) : -1;
        if (rest.startsWith(">") || rest.startsWith("|")) {
          while (pos < lines.length && indentOf(lines[pos]) > indent) pos++;
          value = "";
        } else if (nextInd > indent) {
          value = parseBlock(nextInd);
        } else {
          value = null;
        }
      } else {
        value = scalar(rest);
      }

      if (anchorName) anchors[anchorName] = value;
      map[key] = value;
    }
    return map;
  }

  return parseBlock(0);
}

/* --- checking ---------------------------------------------------------- */

const problems = [];
const notes = [];

/** Field names a collection declares, as a nested shape mirroring the JSON. */
function shapeOfFields(fields) {
  const shape = {};
  for (const f of fields || []) {
    if (!f || !f.name) continue;
    if (f.widget === "object" && f.fields) shape[f.name] = { __object: shapeOfFields(f.fields) };
    else if (f.widget === "list" && f.fields) shape[f.name] = { __list: shapeOfFields(f.fields) };
    else shape[f.name] = true;
  }
  return shape;
}

function compare(where, data, shape) {
  if (!data || typeof data !== "object") return;

  for (const key of Object.keys(data)) {
    const declared = shape[key];
    if (!declared) {
      problems.push(where + "." + key + " exists in the JSON but is NOT declared in config.yml — " +
        "the CMS will delete it the first time this entry is saved");
      continue;
    }
    const value = data[key];
    if (declared === true) continue;
    if (declared.__object) {
      compare(where + "." + key, value, declared.__object);
    } else if (declared.__list) {
      if (Array.isArray(value)) {
        value.forEach((item, i) => {
          if (item && typeof item === "object") compare(where + "." + key + "[" + i + "]", item, declared.__list);
        });
      }
    }
  }

  for (const key of Object.keys(shape)) {
    if (!(key in data)) {
      notes.push(where + "." + key + " is declared in config.yml but missing from the JSON " +
        "(fine for optional fields — the CMS will add it when saved)");
    }
  }
}

const config = parseYaml(fs.readFileSync(CONFIG, "utf8"));
const collections = config.collections || [];
const byName = Object.fromEntries(collections.map(c => [c.name, c]));

console.log("Checking content against site/admin/config.yml…\n");

// folder collections
for (const [name, dir] of [["products", "content/products"], ["subcategories", "content/subcategories"]]) {
  const col = byName[name];
  if (!col) { problems.push("collection '" + name + "' missing from config.yml"); continue; }
  const shape = shapeOfFields(col.fields);
  const full = path.join(ROOT, dir);
  const files = fs.existsSync(full) ? fs.readdirSync(full).filter(f => f.endsWith(".json")) : [];
  for (const f of files) {
    compare(name + "/" + f, JSON.parse(fs.readFileSync(path.join(full, f), "utf8")), shape);
  }
  console.log("  " + name + ": " + files.length + " file(s), " + Object.keys(shape).length + " declared fields");
}

// file collections
for (const name of ["categories", "settings"]) {
  const col = byName[name];
  if (!col) { problems.push("collection '" + name + "' missing from config.yml"); continue; }
  for (const file of col.files || []) {
    const shape = shapeOfFields(file.fields);
    const full = path.join(ROOT, file.file);
    if (!fs.existsSync(full)) { problems.push("config.yml points at " + file.file + ", which does not exist"); continue; }
    compare(name + "/" + file.name, JSON.parse(fs.readFileSync(full, "utf8")), shape);
    console.log("  " + name + "/" + file.name + ": " + Object.keys(shape).length + " declared fields");
  }
}

/* --- report ------------------------------------------------------------ */

if (notes.length) {
  console.log("\nNotes (" + notes.length + "):");
  for (const n of notes.slice(0, 12)) console.log("  · " + n);
  if (notes.length > 12) console.log("  · …and " + (notes.length - 12) + " more");
}

if (problems.length) {
  console.error("\nFAILED — " + problems.length + " problem(s) that would lose content:\n");
  for (const p of problems) console.error("  ✗ " + p);
  console.error("\nAdd the missing field(s) to site/admin/config.yml, then run this again.");
  process.exit(1);
}

console.log("\nOK — every key in content/ is declared in config.yml. Nothing will be dropped on save.");
