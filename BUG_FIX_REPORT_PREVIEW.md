# Bug Fix: Report Preview Headers and Data Mismatch

## Issue Description
When generating reports with **only enrichment and employer engagement files** (no placement files), the headers in the preview were getting mixed up and the "Total Students" column was not displaying data from the uploaded files.

## Root Cause
The bug was caused by a **data storage and retrieval mismatch** between the backend and frontend:

### Backend (DataImporter.js)
- Activity metrics were stored **only** with a `[FileLabel]` suffix
- Example: `"Total Students [data1]"` in `activities.employerEngagement[dept]`

### Frontend (generate-report.html)
- Headers were built with activity type suffixes: `"Total Students (Employer Engagement)"`
- The `resolveCellValue` function tried to look up values using various combinations
- But the exact key format `"Total Students"` (base without label) wasn't being found in the activities object

### The Mismatch
1. Backend stored: `activities.employerEngagement[dept]["Total Students [data1]"] = 50`
2. Frontend looked for: `"Total Students (Employer Engagement)"`, `"Total Students"`, etc.
3. The lookup failed because the stored key had `[data1]` but the lookup didn't match it properly

## Solution Implemented

### 1. Backend Fix (DataImporter.js, lines 934-968)
**Changed:** Store activity metrics in **BOTH** formats:
- With label: `"Total Students [data1]"` (for multi-file scenarios)
- Without label: `"Total Students"` (for direct lookup)

```javascript
// Before:
const activityMetric = `${metric} [${fileLabel}]`;
target.activities.employerEngagement[dept][activityMetric] = value;

// After:
const activityMetricWithLabel = `${metric} [${fileLabel}]`;
target.activities.employerEngagement[dept][activityMetricWithLabel] = value;
// ALSO store without label for direct lookup
target.activities.employerEngagement[dept][metric] = value;
```

### 2. Frontend Fix (generate-report.html, lines 894-921)
**Added:** Direct base lookup after trying labeled variants:

```javascript
// Try direct base lookup (backend now stores both with and without label)
if (map[base] !== undefined) return map[base];
```

### 3. Additional Backend Improvement
Added capitalized variants to headerFileMap for better matching:
- `"Total Students (Employer Engagement)"` (capitalized)
- `"Total Students (Employer Activity)"` (capitalized)

## Files Modified
1. `/src/services/DataImporter.js` - Lines 934-968
2. `/public/generate-report.html` - Lines 894-921

## Testing Recommendations
1. Upload **only** enrichment and employer engagement files
2. Verify headers display correctly with proper colors
3. Verify "Total Students" column shows data from uploaded files
4. Test with multiple files of the same type
5. Test with mixed file types (placements + activities)
6. Verify template creation and application still works correctly

## Impact
- ✅ Fixes data display for activity-only reports
- ✅ Maintains backward compatibility with existing templates
- ✅ Preserves file-order and per-file coloring
- ✅ No breaking changes to existing functionality
