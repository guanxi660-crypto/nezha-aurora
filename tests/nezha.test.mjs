// 功能：執行原始 Vue setup 程式，驗證非同步圖表競態及延遲站點設定。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from '../node_modules/typescript/lib/typescript.js';
import { ref, computed, reactive, watch, nextTick } from '../node_modules/vue/dist/vue.runtime.esm-bundler.js';

function setup(file, bindings, expose, options = {}) {
  const { fireImmediate = false } = options;
  const source = readFileSync(new URL(`../src/views/${file}`, import.meta.url), 'utf8');
  const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1];
  const js = ts.transpileModule(script.replace(/^import[\s\S]*?from\s+["'][^"']+["'];/gm, ''),
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  // 捕获 watch 的 sourceFn / cb / opts，让 triggerWatches 先跑 sourceFn 再把结果传给 cb
  // （与 Vue 真 watch 行为一致，支持 immediate 与依赖变更触发）
  const watchCalls = [];
  const capturedWatch = (sourceFn, cb, opts = {}) => {
    const entry = { sourceFn, cb, opts };
    watchCalls.push(entry);
    if (fireImmediate && opts.immediate) cb(sourceFn());
  };
  const context = vm.createContext({
    ref, computed, reactive, watch: capturedWatch, watchCalls,
    onBeforeUnmount: () => {},
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} },
    ...bindings,
  });
  vm.runInContext(`${js}\nglobalThis.exposed = { ${expose} };\nglobalThis.__watchCalls = watchCalls;`, context);
  return {
    model: context.exposed,
    triggerWatches: () => {
      for (const entry of context.__watchCalls) {
        try { entry.cb(entry.sourceFn()); } catch {}
      }
    },
  };
}

test('older CPU response cannot overwrite newly selected memory series', async () => {
  const pending = [];
  const { model } = setup('ServerDetailView.vue', {
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

test('ForceShowMap loaded after setup selects map view (watch callback triggered)', async () => {
  const state = reactive({ runtime: { forceShowMap: false } });
  const { model, triggerWatches } = setup('HomeView.vue', { state }, 'view');
  state.runtime.forceShowMap = true;
  triggerWatches();
  await nextTick();
  assert.equal(model.view.value, 'map');
});

test('watch-triggered metric switch drops the stale CPU response', async () => {
  const pending = [];
  const { model, triggerWatches } = setup('ServerDetailView.vue', {
    defineProps: () => ({ id: 1 }), serverById: ref(new Map()), state: {},
    fetchServerMetrics: () => new Promise(resolve => pending.push(resolve)),
    fetchMonitor: () => Promise.resolve([]),
  }, 'loadMetrics, metric, points', { fireImmediate: true });

  // fireImmediate 触发：loadMetrics(requestId=1) + loadMonitors(立即 resolve)
  // 所以 pending[0] 是 requestId=1 的 resolve
  const initialCount = pending.length;

  model.metric.value = 'memory';
  triggerWatches();
  assert.equal(pending.length, initialCount + 1, 'metric 切换后 loadMetrics 应再被调一次');
  // pending[initialCount] = requestId=2 的 resolve

  // 先 resolve 新请求（requestId=2）→ 期望 points 更新为 22
  pending[initialCount]({ data_points: [{ ts: 1, value: 22 }] });
  // VM 内部 promise 链（fetch → await → points.value=...）至少要等两个 microtask
  await Promise.resolve();
  await Promise.resolve();

  // 再 resolve 旧请求（requestId=1）→ 因为 requestId != metricsRequestId(=2) 被忽略
  pending[0]({ data_points: [{ ts: 1, value: 99 }] });
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(model.points.value[0].value, 22);
});
