export interface SaveFileResult {
  saved: boolean;
  fileName?: string;
}

export interface OpenFileResult {
  opened: boolean;
  fileName?: string;
  content?: string;
  fileType?: 'sql' | 'er_diagram';
  erData?: any;
}

export interface SaveFileOptions {
  suggestedName: string;
  fileDescription: string;
  mimeType: string;
  extensions: string[];
}

/**
 * Saves arbitrary text content to disk via File System Access API (native Save As dialog)
 * with Blob download fallback.
 */
export async function saveTextWithPicker(
  content: string,
  options: SaveFileOptions
): Promise<SaveFileResult> {
  const { suggestedName, fileDescription, mimeType, extensions } = options;

  // 1. Try File System Access API (Supported in WebView2 / Chromium on Windows)
  if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    try {
      // @ts-expect-error showSaveFilePicker is modern web standard
      const handle = await window.showSaveFilePicker({
        suggestedName,
        types: [
          {
            description: fileDescription,
            accept: {
              [mimeType]: extensions,
            },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      return { saved: true, fileName: handle.name };
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return { saved: false };
      }
      console.warn('showSaveFilePicker failed or was rejected, trying fallback:', err);
    }
  }

  // 2. Fallback: Standard Blob Download
  try {
    if (typeof document === 'undefined') {
      return { saved: false };
    }
    const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = suggestedName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 200);
    return { saved: true, fileName: suggestedName };
  } catch (err) {
    console.error('Blob download fallback failed:', err);
    throw err;
  }
}

/**
 * Saves SQL text to disk via File System Access API with Blob download fallback.
 */
export async function saveSqlToFile(
  sql: string,
  suggestedName: string = 'query.sql'
): Promise<SaveFileResult> {
  const normalizedName = suggestedName.endsWith('.sql') ? suggestedName : `${suggestedName}.sql`;

  return saveTextWithPicker(sql, {
    suggestedName: normalizedName,
    fileDescription: 'SQL Script (*.sql)',
    mimeType: 'text/plain',
    extensions: ['.sql', '.txt'],
  });
}

/**
 * Saves execution plan XML to disk via native File System Access dialog as a .sqlplan file.
 */
export async function savePlanToFile(
  planXml: string,
  suggestedName: string = 'execution_plan.sqlplan'
): Promise<SaveFileResult> {
  const normalizedName = suggestedName.endsWith('.sqlplan')
    ? suggestedName
    : `${suggestedName}.sqlplan`;

  return saveTextWithPicker(planXml, {
    suggestedName: normalizedName,
    fileDescription: 'SQL Server 執行計畫 (*.sqlplan)',
    mimeType: 'application/xml',
    extensions: ['.sqlplan', '.xml'],
  });
}

function processOpenedContent(fileName: string, content: string): OpenFileResult {
  if (fileName.endsWith('.json') || fileName.endsWith('.sqlight-er.json')) {
    try {
      const parsed = JSON.parse(content);
      if (
        (parsed && typeof parsed === 'object' && parsed.type === 'sqlight_er_model') ||
        Array.isArray(parsed?.cells) ||
        Array.isArray(parsed?.nodes) ||
        (parsed && typeof parsed === 'object' && parsed.graph && Array.isArray(parsed.graph.cells))
      ) {
        return {
          opened: true,
          fileName,
          content,
          fileType: 'er_diagram',
          erData: parsed,
        };
      }
    } catch {
      // not valid json, treat as plain text/sql
    }
  }
  return { opened: true, fileName, content, fileType: 'sql' };
}

/**
 * Opens a local SQL or ER Diagram file via File System Access API with input fallback.
 */
export async function openSqlFromFile(): Promise<OpenFileResult> {
  // 1. Try File System Access API (Supported in WebView2 / Chromium)
  if (typeof window !== 'undefined' && 'showOpenFilePicker' in window) {
    try {
      // @ts-expect-error showOpenFilePicker is modern web standard
      const [handle] = await window.showOpenFilePicker({
        types: [
          {
            description: '支援的檔案 (*.sql, *.sqlight-er.json, *.json, *.txt)',
            accept: {
              'text/plain': ['.sql', '.txt'],
              'application/json': ['.json'],
            },
          },
          {
            description: 'SQL Script (*.sql, *.txt)',
            accept: {
              'text/plain': ['.sql', '.txt'],
            },
          },
          {
            description: 'ER Model Diagram (*.sqlight-er.json, *.json)',
            accept: {
              'application/json': ['.json'],
            },
          },
        ],
        multiple: false,
      });
      if (!handle) return { opened: false };
      const file = await handle.getFile();
      const content = await file.text();
      return processOpenedContent(file.name, content);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return { opened: false };
      }
      console.warn('showOpenFilePicker failed or was rejected, trying fallback:', err);
    }
  }

  // 2. Fallback: <input type="file">
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.sql,.txt,.json,.sqlight-er.json';
    input.style.display = 'none';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve({ opened: false });
        return;
      }
      try {
        const content = await file.text();
        resolve(processOpenedContent(file.name, content));
      } catch (e) {
        console.error('Failed to read file:', e);
        resolve({ opened: false });
      } finally {
        if (input.parentNode) {
          input.parentNode.removeChild(input);
        }
      }
    };
    input.oncancel = () => {
      if (input.parentNode) {
        input.parentNode.removeChild(input);
      }
      resolve({ opened: false });
    };
    document.body.appendChild(input);
    input.click();
  });
}

export interface OpenTsvResult {
  opened: boolean;
  fileName?: string;
  content?: string;
}

/**
 * Rejects files that cannot be a UTF-8 TSV (a decoded UTF-16 file is full of NUL chars).
 * Returns an error message, or `null` when the content looks usable.
 */
export function checkUtf8File(content: string): string | null {
  if (content.includes('\u0000')) {
    return '檔案不是 UTF-8 編碼（偵測到 UTF-16 或二進位內容），請另存為 UTF-8 後再匯入';
  }
  return null;
}

/**
 * Opens a local UTF-8 `.tsv` file (File System Access API with `<input type="file">` fallback).
 * Used by the TSV import wizard; size limits are enforced by the caller.
 */
export async function openTsvFile(): Promise<OpenTsvResult> {
  if (typeof window !== 'undefined' && 'showOpenFilePicker' in window) {
    try {
      // @ts-expect-error showOpenFilePicker is modern web standard
      const [handle] = await window.showOpenFilePicker({
        types: [
          {
            description: 'Tab-Separated Values (*.tsv)',
            accept: { 'text/tab-separated-values': ['.tsv', '.txt'] },
          },
        ],
        multiple: false,
      });
      if (!handle) return { opened: false };
      const file = await handle.getFile();
      return { opened: true, fileName: file.name, content: await file.text() };
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return { opened: false };
      }
      console.warn('showOpenFilePicker failed or was rejected, trying fallback:', err);
    }
  }

  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.tsv,.txt';
    input.style.display = 'none';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve({ opened: false });
        return;
      }
      try {
        resolve({ opened: true, fileName: file.name, content: await file.text() });
      } catch (e) {
        console.error('Failed to read TSV file:', e);
        resolve({ opened: false });
      } finally {
        input.parentNode?.removeChild(input);
      }
    };
    input.oncancel = () => {
      input.parentNode?.removeChild(input);
      resolve({ opened: false });
    };
    document.body.appendChild(input);
    input.click();
  });
}

/**
 * Saves arbitrary Blob content to disk via File System Access API (native Save As dialog)
 * with Blob download fallback.
 */
export async function saveBlobWithPicker(
  blob: Blob,
  options: SaveFileOptions
): Promise<SaveFileResult> {
  const { suggestedName, fileDescription, mimeType, extensions } = options;

  // 1. Try File System Access API (Supported in WebView2 / Chromium on Windows)
  if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    try {
      // @ts-expect-error showSaveFilePicker is modern web standard
      const handle = await window.showSaveFilePicker({
        suggestedName,
        types: [
          {
            description: fileDescription,
            accept: {
              [mimeType]: extensions,
            },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return { saved: true, fileName: handle.name };
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return { saved: false };
      }
      console.warn('showSaveFilePicker failed or was rejected, trying fallback:', err);
    }
  }

  // 2. Fallback: Standard Blob Download
  try {
    if (typeof document === 'undefined') {
      return { saved: false };
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = suggestedName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 200);
    return { saved: true, fileName: suggestedName };
  } catch (err) {
    console.error('Blob download fallback failed:', err);
    throw err;
  }
}

/**
 * Converts a base64 Data URI into a Blob.
 */
export function dataUriToBlob(dataUri: string): Blob {
  const parts = dataUri.split(',');
  const header = parts[0] || '';
  const base64 = parts[1] || '';
  const mimeMatch = header.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';

  if (typeof atob === 'function') {
    const binary = atob(base64);
    const len = binary.length;
    const u8 = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      u8[i] = binary.charCodeAt(i);
    }
    return new Blob([u8], { type: mime });
  }

  return new Blob([], { type: mime });
}

/**
 * Saves a Data URI (e.g. PNG base64) to disk via native Save As dialog.
 */
export async function saveDataUriToFile(
  dataUri: string,
  suggestedName: string = 'er-diagram.png'
): Promise<SaveFileResult> {
  const normalizedName = suggestedName.endsWith('.png') ? suggestedName : `${suggestedName}.png`;
  const blob = dataUriToBlob(dataUri);
  return saveBlobWithPicker(blob, {
    suggestedName: normalizedName,
    fileDescription: 'PNG 圖片 (*.png)',
    mimeType: 'image/png',
    extensions: ['.png'],
  });
}

/**
 * Saves SVG string to disk via native Save As dialog.
 */
export async function saveSvgToFile(
  svgString: string,
  suggestedName: string = 'er-diagram.svg'
): Promise<SaveFileResult> {
  const normalizedName = suggestedName.endsWith('.svg') ? suggestedName : `${suggestedName}.svg`;
  return saveTextWithPicker(svgString, {
    suggestedName: normalizedName,
    fileDescription: 'SVG 向量圖 (*.svg)',
    mimeType: 'image/svg+xml',
    extensions: ['.svg'],
  });
}

/**
 * Saves ER diagram JSON string to disk via native Save As dialog.
 */
export async function saveErDiagramToFile(
  jsonContent: string,
  suggestedName: string = 'er-diagram.sqlight-er.json'
): Promise<SaveFileResult> {
  const normalizedName = suggestedName.endsWith('.sqlight-er.json')
    ? suggestedName
    : suggestedName.endsWith('.json')
    ? suggestedName
    : `${suggestedName}.sqlight-er.json`;

  return saveTextWithPicker(jsonContent, {
    suggestedName: normalizedName,
    fileDescription: 'SQLight ER 模型 (*.sqlight-er.json, *.json)',
    mimeType: 'application/json',
    extensions: ['.json'],
  });
}

/**
 * Extracts and aggregates all CSS rules from active document stylesheets into a single CSS string.
 * Used to embed complete styles into exported SVG and PNG files for standalone browser viewing.
 */
export function getAppStylesheets(): string {
  if (typeof document === 'undefined') return '';
  let cssText = '';
  try {
    const sheets = Array.from(document.styleSheets);
    for (const sheet of sheets) {
      try {
        const rules = sheet.cssRules || sheet.rules;
        if (rules) {
          for (let i = 0; i < rules.length; i++) {
            const rule = rules[i];
            if (rule && rule.cssText) {
              cssText += rule.cssText + '\n';
            }
          }
        }
      } catch {
        // Cross-origin or security restriction, ignore
      }
    }
  } catch (e) {
    console.warn('Failed to extract document stylesheets:', e);
  }
  return cssText;
}

/**
 * Downloads a data URI (e.g. PNG base64) to user's disk directly (no picker prompt).
 */
export function downloadDataUri(dataUri: string, filename: string) {
  const link = document.createElement('a');
  link.href = dataUri;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Downloads plain text / JSON / SVG content to user's disk directly (no picker prompt).
 */
export function downloadTextFile(content: string, filename: string, mimeType = 'application/json') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
