export interface SaveFileResult {
  saved: boolean;
  fileName?: string;
}

export interface OpenFileResult {
  opened: boolean;
  fileName?: string;
  content?: string;
}

/**
 * Saves SQL text to disk via File System Access API with Blob download fallback.
 */
export async function saveSqlToFile(
  sql: string,
  suggestedName: string = 'query.sql'
): Promise<SaveFileResult> {
  const normalizedName = suggestedName.endsWith('.sql') ? suggestedName : `${suggestedName}.sql`;

  // 1. Try File System Access API (Supported in WebView2 / Chromium)
  if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    try {
      // @ts-expect-error showSaveFilePicker is modern web standard
      const handle = await window.showSaveFilePicker({
        suggestedName: normalizedName,
        types: [
          {
            description: 'SQL Script (*.sql)',
            accept: {
              'text/plain': ['.sql', '.txt'],
            },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(sql);
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
    const blob = new Blob([sql], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = normalizedName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 200);
    return { saved: true, fileName: normalizedName };
  } catch (err) {
    console.error('Blob download fallback failed:', err);
    throw err;
  }
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
