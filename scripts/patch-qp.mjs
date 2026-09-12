import fs from 'node:fs';
import path from 'node:path';

const filesToPatch = [
  path.resolve('node_modules/html-query-plan/dist/qp.js'),
  path.resolve('node_modules/html-query-plan/dist/qp.min.js'),
];

let patchedCount = 0;
for (const file of filesToPatch) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    let modified = false;

    // 1. Fix Webpack AMD define wrapper bare function call factory(root, root.document)
    if (content.includes('return factory(root, root.document)')) {
      content = content.replace(
        'return factory(root, root.document)',
        'return factory.call(root, root, root.document)'
      );
      modified = true;
    }

    // 2. Fix this.SVG = function assignment in qp.js
    if (content.includes('var SVG = this.SVG =')) {
      content = content.replace(
        'var SVG = this.SVG =',
        'var SVG = (typeof window !== "undefined" ? window : this).SVG ='
      );
      modified = true;
    }

    // 3. Fix this.SVG = function assignment in qp.min.js
    if (content.includes('var n=this.SVG=')) {
      content = content.replace(
        'var n=this.SVG=',
        'var n=(typeof window !== "undefined" ? window : this).SVG='
      );
      modified = true;
    }

    // 4. Do not hide tooltip immediately on mouseout; keep it open until click outside or next tooltip
    if (/window\.clearTimeout\(timeoutId\);[\r\n\s]+timeoutId\s*=\s*null;[\r\n\s]+hideTooltip\(\);/.test(content)) {
      content = content.replace(
        /window\.clearTimeout\(timeoutId\);[\r\n\s]+timeoutId\s*=\s*null;[\r\n\s]+hideTooltip\(\);/,
        'window.clearTimeout(timeoutId);\n    timeoutId = null;'
      );
      modified = true;
    }

    // 5. Reset timeoutId inside showTooltip so next node hover starts immediately
    if (/function showTooltip\(node,\s*tooltip\)\s*\{[\r\n\s]+hideTooltip\(\);/.test(content)) {
      content = content.replace(
        /function showTooltip\(node,\s*tooltip\)\s*\{[\r\n\s]+hideTooltip\(\);/,
        'function showTooltip(node, tooltip) {\n    hideTooltip();\n    timeoutId = null;'
      );
      modified = true;
    }

    // 6. Safe removeChild in hideTooltip and expose window.QP_hideTooltip
    if (content.includes('function hideTooltip() {') && !content.includes('window.QP_hideTooltip')) {
      content = content.replace(
        'function hideTooltip() {',
        'function hideTooltip() {\n    if (typeof window !== "undefined") { window.QP_hideTooltip = hideTooltip; }'
      );
      modified = true;
    }
    if (content.includes('document.body.removeChild(currentTooltip);')) {
      content = content.replace(
        'document.body.removeChild(currentTooltip);',
        'if (currentTooltip && currentTooltip.parentNode === document.body) { document.body.removeChild(currentTooltip); }'
      );
      modified = true;
    }

    if (modified) {
      fs.writeFileSync(file, content, 'utf8');
      patchedCount++;
    }
  }
}

if (patchedCount > 0) {
  console.log(`[SQLight] Successfully patched ${patchedCount} html-query-plan file(s) for modern ESM strict-mode & persistent tooltips.`);
}
