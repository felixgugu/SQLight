import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dataUriToBlob,
  saveDataUriToFile,
  saveSvgToFile,
  saveErDiagramToFile,
  getAppStylesheets,
} from '../src/utils/fileStorage';

const SAMPLE_PNG_DATA_URI =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

test('dataUriToBlob correctly converts base64 DataURI to Blob with proper MIME type', () => {
  const blob = dataUriToBlob(SAMPLE_PNG_DATA_URI);
  assert.equal(blob.type, 'image/png');
  assert.ok(blob.size > 0);
});

test('saveDataUriToFile prompts showSaveFilePicker with PNG filter and writes binary blob', async () => {
  let pickerCalledWith: any = null;
  let writtenBlob: any = null;
  let streamClosed = false;

  (globalThis as any).window = {
    showSaveFilePicker: async (opts: any) => {
      pickerCalledWith = opts;
      return {
        name: opts.suggestedName,
        createWritable: async () => ({
          write: async (chunk: any) => {
            writtenBlob = chunk;
          },
          close: async () => {
            streamClosed = true;
          },
        }),
      };
    },
  };

  const res = await saveDataUriToFile(SAMPLE_PNG_DATA_URI, 'Orders');

  assert.equal(res.saved, true);
  assert.equal(res.fileName, 'Orders.png');
  assert.equal(streamClosed, true);
  assert.ok(writtenBlob instanceof Blob);
  assert.equal(writtenBlob.type, 'image/png');
  assert.equal(pickerCalledWith.suggestedName, 'Orders.png');
  assert.equal(pickerCalledWith.types[0].description, 'PNG 圖片 (*.png)');
  assert.ok(pickerCalledWith.types[0].accept['image/png'].includes('.png'));

  delete (globalThis as any).window;
});

test('saveSvgToFile prompts showSaveFilePicker with SVG filter and writes text content', async () => {
  let pickerCalledWith: any = null;
  let writtenText = '';
  let streamClosed = false;

  (globalThis as any).window = {
    showSaveFilePicker: async (opts: any) => {
      pickerCalledWith = opts;
      return {
        name: opts.suggestedName,
        createWritable: async () => ({
          write: async (chunk: string) => {
            writtenText = chunk;
          },
          close: async () => {
            streamClosed = true;
          },
        }),
      };
    },
  };

  const sampleSvg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100"/></svg>';
  const res = await saveSvgToFile(sampleSvg, 'Orders');

  assert.equal(res.saved, true);
  assert.equal(res.fileName, 'Orders.svg');
  assert.equal(writtenText, sampleSvg);
  assert.equal(streamClosed, true);
  assert.equal(pickerCalledWith.suggestedName, 'Orders.svg');
  assert.equal(pickerCalledWith.types[0].description, 'SVG 向量圖 (*.svg)');
  assert.ok(pickerCalledWith.types[0].accept['image/svg+xml'].includes('.svg'));

  delete (globalThis as any).window;
});

test('saveErDiagramToFile prompts showSaveFilePicker with JSON filter and writes model content', async () => {
  let pickerCalledWith: any = null;
  let writtenText = '';
  let streamClosed = false;

  (globalThis as any).window = {
    showSaveFilePicker: async (opts: any) => {
      pickerCalledWith = opts;
      return {
        name: opts.suggestedName,
        createWritable: async () => ({
          write: async (chunk: string) => {
            writtenText = chunk;
          },
          close: async () => {
            streamClosed = true;
          },
        }),
      };
    },
  };

  const sampleJson = JSON.stringify({ type: 'sqlight_er_model', version: '1.0' });
  const res = await saveErDiagramToFile(sampleJson, 'Customer_ER');

  assert.equal(res.saved, true);
  assert.equal(res.fileName, 'Customer_ER.sqlight-er.json');
  assert.equal(writtenText, sampleJson);
  assert.equal(streamClosed, true);
  assert.equal(pickerCalledWith.suggestedName, 'Customer_ER.sqlight-er.json');
  assert.equal(pickerCalledWith.types[0].description, 'SQLight ER 模型 (*.sqlight-er.json, *.json)');
  assert.ok(pickerCalledWith.types[0].accept['application/json'].includes('.json'));
  assert.ok(!pickerCalledWith.types[0].accept['application/json'].includes('.sqlight-er.json'));

  delete (globalThis as any).window;
});

test('getAppStylesheets handles environments gracefully and returns string', () => {
  const css = getAppStylesheets();
  assert.equal(typeof css, 'string');
});

test('saveDataUriToFile / saveSvgToFile / saveErDiagramToFile return { saved: false } on user cancellation', async () => {
  (globalThis as any).window = {
    showSaveFilePicker: async () => {
      const abortErr = new Error('The user aborted a request.');
      abortErr.name = 'AbortError';
      throw abortErr;
    },
  };

  const resPng = await saveDataUriToFile(SAMPLE_PNG_DATA_URI, 'Orders.png');
  assert.equal(resPng.saved, false);
  assert.equal(resPng.fileName, undefined);

  const resSvg = await saveSvgToFile('<svg/>', 'Orders.svg');
  assert.equal(resSvg.saved, false);
  assert.equal(resSvg.fileName, undefined);

  const resJson = await saveErDiagramToFile('{}', 'Orders.sqlight-er.json');
  assert.equal(resJson.saved, false);
  assert.equal(resJson.fileName, undefined);

  delete (globalThis as any).window;
});
