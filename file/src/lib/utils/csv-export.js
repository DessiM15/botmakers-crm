/**
 * Convert array of objects to CSV string.
 * Handles commas, quotes, and newlines in values.
 */
export function arrayToCSV(data, columns) {
  if (!data || data.length === 0) return '';

  const headers = columns.map(c => c.label);
  const rows = data.map(row =>
    columns.map(c => {
      let val = c.accessor ? c.accessor(row) : row[c.key] ?? '';
      val = String(val);
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        val = '"' + val.replace(/"/g, '""') + '"';
      }
      return val;
    })
  );

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

/**
 * Trigger browser download of a CSV file.
 */
export function downloadCSV(csvString, filename) {
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
