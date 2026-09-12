import type { QueryResult, ResultSet } from '@/types/query';

/**
 * Extracts ShowPlanXML payload from QueryResult or ResultSet array, returning the XML string and clean result sets.
 */
export function extractShowPlanXml(input: QueryResult | ResultSet[]): {
  cleanedResultSets: ResultSet[];
  cleanResultSets: ResultSet[];
  planXml: string | null;
} {
  const resultSets = Array.isArray(input) ? input : (input.resultSets || []);
  let planXml: string | null = null;
  const cleaned: ResultSet[] = [];

  for (const rs of resultSets) {
    const isXmlColumn = rs.columns.some((c) =>
      /XML\s+Showplan/i.test(c.name) ||
      /ShowPlanXML/i.test(c.name) ||
      c.dataType.toLowerCase() === 'xml'
    );
    const firstCell = String(rs.rows[0]?.[0] || '');
    const hasXmlContent = firstCell.includes('<ShowPlanXML');

    if (isXmlColumn || hasXmlContent) {
      const chunks = rs.rows
        .map((r) => String(r[0] || ''))
        .filter((s) => s.trim().length > 0);
      planXml = chunks.join('\n');
    } else {
      cleaned.push(rs);
    }
  }

  return { cleanedResultSets: cleaned, cleanResultSets: cleaned, planXml };
}

/**
 * Cleanly formats / indents raw XML string for readable display
 */
export function formatXml(xml: string): string {
  if (!xml || !xml.trim()) return '';
  let formatted = '';
  let indent = 0;
  const tab = '  ';

  // Normalize lines and tags
  const clean = xml.replace(/>\s*</g, '><').trim();
  const regex = /(<[^>]+>)/g;
  const tokens = clean.split(regex).filter(Boolean);

  for (const token of tokens) {
    if (token.startsWith('</')) {
      indent = Math.max(0, indent - 1);
      formatted += `${tab.repeat(indent)}${token}\n`;
    } else if (token.startsWith('<') && !token.startsWith('<?') && !token.startsWith('<!')) {
      formatted += `${tab.repeat(indent)}${token}\n`;
      if (!token.endsWith('/>')) {
        indent++;
      }
    } else if (token.startsWith('<?') || token.startsWith('<!')) {
      formatted += `${token}\n`;
    } else {
      const text = token.trim();
      if (text) {
        formatted += `${tab.repeat(indent)}${text}\n`;
      }
    }
  }

  return formatted.trim();
}
