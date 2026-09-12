export interface SaveFileResult {
  saved: boolean;
  fileName?: string;
}

export interface OpenFileResult {
  opened: boolean;
  fileName?: string;
  content?: string;
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

/**
 * Opens a local SQL file via File System Access API with input fallback.
 */
export async function openSqlFromFile(): Promise<OpenFileResult> {
  // 1. Try File System Access API (Supported in WebView2 / Chromium)
  if (typeof window !== 'undefined' && 'showOpenFilePicker' in window) {
    try {
      // @ts-expect-error showOpenFilePicker is modern web standard
      const [handle] = await window.showOpenFilePicker({
        types: [
          {
            description: 'SQL Script (*.sql, *.txt)',
            accept: {
              'text/plain': ['.sql', '.txt'],
            },
          },
        ],
        multiple: false,
      });
      if (!handle) return { opened: false };
      const file = await handle.getFile();
      const content = await file.text();
      return { opened: true, fileName: file.name, content };
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
    input.accept = '.sql,.txt';
    input.style.display = 'none';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve({ opened: false });
        return;
      }
      try {
        const content = await file.text();
        resolve({ opened: true, fileName: file.name, content });
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
