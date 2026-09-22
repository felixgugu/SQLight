import type { Window } from '@tauri-apps/api/window';
import { isTauri } from './api';

/**
 * 視窗控制服務：封裝 Tauri 視窗 API，避免 UI 元件直接相依 @tauri-apps/api。
 *
 * 所有方法在瀏覽器 (Vite) 開發模式下皆為安全的無作用版本，因此元件可無條件呼叫。
 */

/**
 * 延遲載入 @tauri-apps/api/window：此模組需要 Tauri 執行環境，
 * 且動態載入可避免把視窗 API 打包進首次載入的 chunk。
 */
async function resolveWindow(): Promise<Window | null> {
  if (!isTauri()) return null;
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    return getCurrentWindow();
  } catch (err) {
    console.warn('[SQLight] window API unavailable:', err);
    return null;
  }
}

export const windowService = {
  /**
   * 目前平台是否使用「自繪標題列」。
   *
   * Windows 透過 tauri.windows.conf.json 關閉原生裝飾 (decorations: false)，
   * 其餘平台仍保留系統原生視窗，因此不需要額外的視窗控制按鈕。
   */
  isCustomTitleBar(): boolean {
    if (!isTauri()) return false;
    if (typeof navigator === 'undefined') return false;
    return /Windows/i.test(navigator.userAgent);
  },

  async isMaximized(): Promise<boolean> {
    const window = await resolveWindow();
    if (!window) return false;
    try {
      return await window.isMaximized();
    } catch (err) {
      console.warn('[SQLight] Unable to read window maximized state:', err);
      return false;
    }
  },

  async minimize(): Promise<void> {
    const window = await resolveWindow();
    if (!window) return;
    try {
      await window.minimize();
    } catch (err) {
      console.warn('[SQLight] Unable to minimize window:', err);
    }
  },

  async toggleMaximize(): Promise<void> {
    const window = await resolveWindow();
    if (!window) return;
    try {
      await window.toggleMaximize();
    } catch (err) {
      console.warn('[SQLight] Unable to toggle window maximize state:', err);
    }
  },

  async close(): Promise<void> {
    const window = await resolveWindow();
    if (!window) return;
    try {
      await window.close();
    } catch (err) {
      console.warn('[SQLight] Unable to close window:', err);
    }
  },

  /**
   * 訂閱視窗尺寸變化，用於同步「最大化 / 還原」按鈕圖示。
   * 回傳取消訂閱函式；非 Tauri 環境回傳空函式。
   */
  async onResized(handler: () => void): Promise<() => void> {
    const window = await resolveWindow();
    if (!window) return () => {};
    try {
      return await window.onResized(() => handler());
    } catch (err) {
      console.warn('[SQLight] window resize listener unavailable:', err);
      return () => {};
    }
  },
};

export default windowService;
