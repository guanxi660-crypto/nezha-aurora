// 功能：執行原始 Vue setup 程式，驗證非同步圖表競態及延遲站點設定。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from '../node_modules/typescript/lib/typescript.js';
import { ref, computed, reactive, watch, nextTick } from '../node_modules/vue/dist/vue.runtime.esm-bundler.js';

function setup(file, bindings, expose) {
  const source = readFileSync(new URL(`../src/views/${file}`, import.meta.url), 'utf8');
  const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1];
  const js = ts.transpileModule(script.replace(/^import[\s\S]*?from\s+["'][^"']+["'];/gm, ''),
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  // ServerDetailView 的 immediate watch 會觸發未 stub 的依賴,僅 HomeView 測試注入真 watch
  const context = vm.createContext({ ref, computed, watch: () => {}, localStorage: { getItem: () => null }, ...bindings });
  vm.runInContext(`${js}\nglobalThis.exposed = { ${expose} };`, context);
  return context.exposed;
}

test('older CPU response cannot overwrite newly selected memory series', async () => {
  const pending = [];
  const model = setup('ServerDetailView.vue', {
    defineProps: () => ({ id: 1 }), serverById: ref(new Map()), state: {},
    fetchServerMetrics: () => new Promise(resolve => pending.push(resolve)),
  }, 'loadMetrics, metric, points');
  const cpu = model.loadMetrics();
  model.metric.value = 'memory';
  const memory = model.loadMetrics();
  pending[1]({ data_points: [{ ts: 1, value: 22 }] });
  await memory;
  pending[0]({ data_points: [{ ts: 1, value: 99 }] });
  await cpu;
  assert.equal(model.points.value[0].value, 22);
});

test('ForceShowMap loaded after setup selects map view', async () => {
  const state = reactive({ runtime: { forceShowMap: false } });
  const model = setup('HomeView.vue', { state, watch }, 'view');
  state.runtime.forceShowMap = true;
  await nextTick();
  assert.equal(model.view.value, 'map');
});
