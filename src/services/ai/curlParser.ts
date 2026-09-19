export interface ParsedCurl {
  url: string;
  method: string;
  headers: Record<string, string>;
  dataRaw: string;
}

/**
 * 從文字中擷取頂層 JSON 物件或陣列區塊 ({ ... } 或 [ ... ])
 */
function extractJsonBlock(text: string): string | null {
  const firstBrace = text.indexOf('{');
  const firstBracket = text.indexOf('[');
  let startIdx = -1;
  let openChar = '{';
  let closeChar = '}';

  if (firstBrace !== -1 && firstBracket !== -1) {
    if (firstBrace < firstBracket) {
      startIdx = firstBrace;
      openChar = '{';
      closeChar = '}';
    } else {
      startIdx = firstBracket;
      openChar = '[';
      closeChar = ']';
    }
  } else if (firstBrace !== -1) {
    startIdx = firstBrace;
    openChar = '{';
    closeChar = '}';
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
    openChar = '[';
    closeChar = ']';
  } else {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = startIdx; i < text.length; i++) {
    const char = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === '\\') {
      escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === openChar) {
        depth++;
      } else if (char === closeChar) {
        depth--;
        if (depth === 0) {
          return text.substring(startIdx, i + 1).trim();
        }
      }
    }
  }

  // 若結尾括號被裁切，嘗試容錯至最後一個匹配的閉合括號
  const lastClose = text.lastIndexOf(closeChar);
  if (lastClose > startIdx) {
    return text.substring(startIdx, lastClose + 1).trim();
  }

  return null;
}

/**
 * 解析使用者貼上的 curl 命令字串
 */
export function parseCurlCommand(rawCurl: string): ParsedCurl {
  const result: ParsedCurl = {
    url: '',
    method: 'POST',
    headers: {},
    dataRaw: '',
  };

  // 清除換行斜線符號 (\) 與多餘空格
  const normalized = rawCurl.replace(/\\\r?\n/g, ' ').trim();

  // 1. 擷取 URL (--url '...' 或 --url "..." 或任意位置的 http(s) URL)
  const explicitUrlMatch =
    normalized.match(/--url\s+['"]([^'"]+)['"]/i) ||
    normalized.match(/--url\s+([^\s]+)/i);

  if (explicitUrlMatch && explicitUrlMatch[1]) {
    result.url = explicitUrlMatch[1].trim();
  } else {
    // 尋找未被 -H 或 --header 包裹的獨立網址
    const genericUrlMatch = normalized.match(/['"]?(https?:\/\/[^\s'"]+)['"]?/i);
    if (genericUrlMatch && genericUrlMatch[1]) {
      result.url = genericUrlMatch[1].trim();
    }
  }

  // 2. 擷取 Method (-X POST 或 --request POST)
  const methodMatch =
    normalized.match(/(?:-X|--request)\s+['"]?([A-Za-z]+)['"]?/i);
  if (methodMatch && methodMatch[1]) {
    result.method = methodMatch[1].toUpperCase().trim();
  }

  // 3. 擷取 Headers (-H 'Key: Value' 或 --header "Key: Value")
  const headerRegex = /(?:-H|--header)\s+['"]([^'"]+)['"]/gi;
  let headerMatch;
  while ((headerMatch = headerRegex.exec(normalized)) !== null) {
    const rawHeader = headerMatch[1] ?? '';
    const colonIdx = rawHeader.indexOf(':');
    if (colonIdx > 0) {
      const key = rawHeader.substring(0, colonIdx).trim();
      const val = rawHeader.substring(colonIdx + 1).trim();
      result.headers[key] = val;
    }
  }

  // 4. 擷取 Data / Body (-d '...' 或 --data '...' 或 --data-raw '...')
  const dataFlagMatch = rawCurl.match(/(?:--data-raw|--data-binary|--data-ascii|--data|-d)\s+/i);
  if (dataFlagMatch && dataFlagMatch.index !== undefined) {
    const afterData = rawCurl.substring(dataFlagMatch.index + dataFlagMatch[0].length).trim();

    // 優先嘗試精準擷取結構化 JSON 區塊
    const jsonBlock = extractJsonBlock(afterData);
    if (jsonBlock) {
      result.dataRaw = jsonBlock;
    } else {
      // 若非 JSON，則依據引號擷取字串或至下一個參數
      const quoteMatch = afterData.match(/^(['"])([\s\S]*?)\1/);
      if (quoteMatch && quoteMatch[2] !== undefined) {
        result.dataRaw = quoteMatch[2].trim();
      } else {
        const unquotedMatch = afterData.match(/^([^\s]+)/);
        if (unquotedMatch && unquotedMatch[1] !== undefined) {
          result.dataRaw = unquotedMatch[1].trim();
        }
      }
    }
  }

  return result;
}
