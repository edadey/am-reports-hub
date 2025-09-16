#!/usr/bin/env node
/**
 * Backport percentage logic into existing report JSON files.
 * - Empty/unparseable percentage cells -> 0
 * - Normalize percentage values: "55%" -> 0.55, 55 -> 0.55, 0.55 stays 0.55
 * - Recompute totals row percentage columns as average across ALL rows (empties=0)
 *
 * This preserves column order and only touches percentage columns.
 */

const fs = require('fs');
const path = require('path');

const REPORTS_DIR = path.join(__dirname, 'data', 'data', 'reports');

function isPercentHeader(header) {
  if (!header) return false;
  const h = String(header).toLowerCase();
  return h.includes('percent') || h.includes('%');
}

function normalizePercentCell(cell) {
  if (cell === undefined || cell === null || cell === '') return 0;
  if (typeof cell === 'number') {
    if (!isFinite(cell)) return 0;
    // If value looks like 55 (i.e., > 1), treat as 55%
    return cell > 1 ? cell / 100 : cell;
  }
  if (typeof cell === 'string') {
    const s = cell.trim();
    if (!s) return 0;
    if (s.endsWith('%')) {
      const p = parseFloat(s);
      return isNaN(p) ? 0 : p / 100;
    }
    const p = parseFloat(s);
    if (isNaN(p)) return 0;
    return p > 1 ? p / 100 : p;
  }
  return 0;
}

function processReportData(headers, rows) {
  if (!Array.isArray(headers) || !Array.isArray(rows)) return { headers, rows };

  // Identify percent columns by header
  const percentCols = new Set();
  headers.forEach((h, idx) => { if (isPercentHeader(h)) percentCols.add(idx); });
  if (!percentCols.size) return { headers, rows };

  // Find totals row index
  const totalRowIndex = rows.findIndex(r => String(r?.[0] || '').toLowerCase() === 'total');

  const dataRowEnd = totalRowIndex >= 0 ? totalRowIndex : rows.length;

  // Normalize data rows percentage cells
  for (let r = 0; r < dataRowEnd; r++) {
    const row = rows[r];
    if (!Array.isArray(row)) continue;
    percentCols.forEach(cIdx => {
      row[cIdx] = normalizePercentCell(row[cIdx]);
    });
  }

  // Recompute totals row percentage averages across ALL data rows
  if (totalRowIndex >= 0) {
    const totalRow = rows[totalRowIndex];
    const n = dataRowEnd; // number of data rows
    percentCols.forEach(cIdx => {
      if (n === 0) {
        totalRow[cIdx] = 0;
        return;
      }
      let sum = 0;
      for (let r = 0; r < dataRowEnd; r++) {
        sum += normalizePercentCell(rows[r]?.[cIdx]);
      }
      const avg = sum / n;
      totalRow[cIdx] = avg;
    });
  }

  return { headers, rows };
}

function processReportObject(obj) {
  // Handle structures with data.headers/rows or top-level headers/rows
  if (obj && obj.data && Array.isArray(obj.data.headers) && Array.isArray(obj.data.rows)) {
    const { headers, rows } = processReportData(obj.data.headers, obj.data.rows);
    obj.data.headers = headers;
    obj.data.rows = rows;
    return true;
  }
  if (obj && Array.isArray(obj.headers) && Array.isArray(obj.rows)) {
    const { headers, rows } = processReportData(obj.headers, obj.rows);
    obj.headers = headers;
    obj.rows = rows;
    return true;
  }
  return false;
}

function backupPath(filePath) {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath, '.json');
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  return path.join(dir, `${base}.pre-backport-${ts}.bak.json`);
}

function run() {
  console.log(`📁 Scanning ${REPORTS_DIR} ...`);
  const entries = fs.readdirSync(REPORTS_DIR).filter(f => f.endsWith('.json'));
  let filesTouched = 0;
  let reportsUpdated = 0;

  for (const name of entries) {
    const full = path.join(REPORTS_DIR, name);
    try {
      const raw = fs.readFileSync(full, 'utf8');
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        console.warn(`⚠️  Skip invalid JSON: ${name} (${e.message})`);
        continue;
      }

      let changed = false;
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (processReportObject(item)) {
            changed = true;
            reportsUpdated++;
          }
        }
      } else if (parsed && typeof parsed === 'object') {
        if (processReportObject(parsed)) {
          changed = true;
          reportsUpdated++;
        }
      }

      if (changed) {
        // Backup and write
        const bak = backupPath(full);
        fs.writeFileSync(bak, raw, 'utf8');
        fs.writeFileSync(full, JSON.stringify(parsed, null, 2), 'utf8');
        filesTouched++;
        console.log(`✅ Updated ${name} (backup: ${path.basename(bak)})`);
      } else {
        console.log(`ℹ️  No report structures found in ${name}, skipped.`);
      }
    } catch (e) {
      console.error(`❌ Error processing ${name}:`, e.message);
    }
  }

  console.log(`\nDone. Files touched: ${filesTouched}, reports updated: ${reportsUpdated}`);
}

if (require.main === module) run();
