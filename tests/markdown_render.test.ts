import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  renderMarkdownToHtml,
  sanitizeHtml,
  enhanceHtml,
} from '../src/utils/markdownRenderer.ts';

describe('Markdown to HTML Renderer', () => {
  describe('GFM Tables', () => {
    it('should convert GFM markdown table into HTML table wrapped with .ai-table-wrapper', () => {
      const markdown = `
| 欄位名稱 | 資料型態 | 可為 NULL | 說明 |
| :--- | :---: | :---: | :--- |
| CustomerID | nchar(5) | 否 | 主鍵 (PK) |
| CompanyName | nvarchar(40) | 否 | 公司名稱 |
| City | nvarchar(15) | 是 | 所在城市 |
`;

      const html = renderMarkdownToHtml(markdown);

      assert.ok(html.includes('<div class="ai-table-wrapper">'));
      assert.ok(html.includes('<table class="ai-markdown-table">'));
      assert.ok(html.includes('欄位名稱</th>'));
      assert.ok(html.includes('資料型態</th>'));
      assert.ok(html.includes('CustomerID</td>'));
      assert.ok(html.includes('nchar(5)</td>'));
      assert.ok(html.includes('公司名稱</td>'));
      assert.ok(html.includes('</table></div>'));
    });

    it('should handle multiple tables correctly', () => {
      const markdown = `
### 表格 1
| A | B |
|---|---|
| 1 | 2 |

### 表格 2
| C | D |
|---|---|
| 3 | 4 |
`;

      const html = renderMarkdownToHtml(markdown);

      const wrapperMatches = html.match(/<div class="ai-table-wrapper">/g);
      assert.equal(wrapperMatches?.length, 2);
    });
  });

  describe('Standard Markdown Formatting', () => {
    it('should render headings (H1-H6), lists, bold, italics, blockquotes, and inline code (backticks)', () => {
      const markdown = `
# 一級標題
## 二級標題
### 三級標題
#### 四級標題
##### 五級標題
###### 六級標題

這是一段包含 **粗體** 與 *斜體* 以及 \`inline_code()\` 與 \`SELECT * FROM Users\` 的文字。

- 清單項目 1
- 清單項目 2

1. 順序項目 A
2. 順序項目 B

> 這是引言備註
`;

      const html = renderMarkdownToHtml(markdown);

      assert.ok(html.includes('<h1') && html.includes('一級標題</h1>'));
      assert.ok(html.includes('<h2') && html.includes('二級標題</h2>'));
      assert.ok(html.includes('<h3') && html.includes('三級標題</h3>'));
      assert.ok(html.includes('<h4') && html.includes('四級標題</h4>'));
      assert.ok(html.includes('<h5') && html.includes('五級標題</h5>'));
      assert.ok(html.includes('<h6') && html.includes('六級標題</h6>'));
      assert.ok(html.includes('<strong>粗體</strong>'));
      assert.ok(html.includes('<em>斜體</em>'));
      assert.ok(html.includes('<code>inline_code()</code>'));
      assert.ok(html.includes('<code>SELECT * FROM Users</code>'));
      assert.ok(html.includes('<ul>') && html.includes('<li>清單項目 1</li>'));
      assert.ok(html.includes('<ol>') && html.includes('<li>順序項目 A</li>'));
      assert.ok(html.includes('<blockquote>'));
      assert.ok(html.includes('這是引言備註'));
    });

    it('should enhance links with target="_blank" and rel="noopener noreferrer"', () => {
      const markdown = '請參考 [微軟官方文檔](https://learn.microsoft.com/sql) 取得完整指南。';
      const html = renderMarkdownToHtml(markdown);

      assert.ok(html.includes('href="https://learn.microsoft.com/sql"'));
      assert.ok(html.includes('target="_blank"'));
      assert.ok(html.includes('rel="noopener noreferrer"'));
      assert.ok(html.includes('微軟官方文檔</a>'));
    });
  });

  describe('XSS Sanitization & Safety', () => {
    it('should strip script tags and dangerous event handlers', () => {
      const dangerous = `
# 標題
<script>alert('pwned')</script>
<img src="valid.jpg" onerror="alert(1)" onload="evil()" />
<iframe src="https://attacker.com"></iframe>
<a href="javascript:alert(1)">點擊我</a>
`;

      const html = renderMarkdownToHtml(dangerous);

      assert.ok(!html.includes('<script>'));
      assert.ok(!html.includes('alert(\'pwned\')'));
      assert.ok(!html.includes('<iframe'));
      assert.ok(!html.includes('onerror'));
      assert.ok(!html.includes('onload'));
      assert.ok(!html.includes('javascript:'));
    });

    it('should sanitizeHtml directly', () => {
      const dirty = '<a href="javascript:doBad()" onclick="bad()">Click</a><script>console.log(1)</script>';
      const clean = sanitizeHtml(dirty);

      assert.ok(!clean.includes('<script>'));
      assert.ok(!clean.includes('onclick'));
      assert.ok(!clean.includes('javascript:'));
    });
  });

  describe('Edge Cases', () => {
    it('should return empty string for null, undefined, or empty text', () => {
      assert.equal(renderMarkdownToHtml(''), '');
      assert.equal(renderMarkdownToHtml('   '), '');
      assert.equal(renderMarkdownToHtml(null), '');
      assert.equal(renderMarkdownToHtml(undefined), '');
    });

    it('should gracefully handle plain text without markdown syntax', () => {
      const plain = '這是一段簡單的純文字回覆。';
      const html = renderMarkdownToHtml(plain);
      assert.ok(html.includes('這是一段簡單的純文字回覆。'));
    });
  });
});
