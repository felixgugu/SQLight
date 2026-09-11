import * as monaco from 'monaco-editor';
import EditorWorker from './editorWorker?worker';

self.MonacoEnvironment = {
  getWorker: function (_moduleId: unknown, _label: string) {
    return new EditorWorker();
  },
};

export { monaco };
