/**
 * A small hand-rolled YAML reader for the subset site/admin/config.yml needs,
 * so the project stays dependency-free.
 *
 * Two callers read that file: check-config.js, which walks every declared field
 * to make sure the CMS will not drop content on save, and content.js, which
 * takes the size vocabulary out of the admin's own dropdown. Both go through
 * here so there is one parser to trust rather than two.
 *
 * Handles: nested maps, block sequences, inline {a: b} maps, [a, b] flow
 * sequences, quoted scalars, anchors and aliases. Block scalars (> and |) are
 * read as "" — no caller needs their text.
 */

"use strict";

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

module.exports = { parseYaml };
