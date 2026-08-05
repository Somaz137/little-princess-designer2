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
 * The YAML reader it uses is in tools/yaml.js, shared with content.js.
 */

const fs = require("fs");
const path = require("path");
const { parseYaml } = require("./yaml");

const ROOT = path.join(__dirname, "..");
const CONFIG = path.join(ROOT, "site", "admin", "config.yml");

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
