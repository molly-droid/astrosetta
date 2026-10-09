const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { loadEdge } = require('./load-edge.cjs');

test('Navigator shim preserves structured HTTP gate/quota errors', async () => {
  for (const [status, code] of [[429, 'limit_reached'], [403, 'upgrade_required']]) {
    const { agents } = loadEdge('apps/web/src/api/shim/agents.js', {
      mocks: { './supabase.js': { supabase: { functions: { invoke: async () => ({
        error: { message: 'Non-2xx response', context: Response.json({ code }, { status }) },
      }) } } } },
    });
    await assert.rejects(agents.addMessage({ id: 'chat' }, { content: 'hello' }),
      error => error.code === code && error.status === status);
  }
});

// Execute the actual component's send closure without mounting its unrelated
// chart/rendering dependencies. This checks recovery after every async step.
const filename = path.resolve(__dirname, '../../apps/web/src/components/navigator/FloatingNavigator.jsx');
const source = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
let sendSource;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'send') sendSource = node.initializer.getText(source);
  ts.forEachChild(node, visit);
}
visit(source);
assert.ok(sendSource, 'real send handler located');

async function runSend({ error, newerDraft = '', contextError = false } = {}) {
  const state = { input: 'hello', sending: false, error: '', calls: 0 };
  const send = vm.runInNewContext(`(${sendSource})`, {
    input: 'hello', sending: false, conversationRef: { current: { id: 'chat' } },
    setInput: value => { state.input = typeof value === 'function' ? value(state.input) : value; },
    setSending: value => { state.sending = value; },
    setSendError: value => { state.error = value; },
    savedChartsListRef: { current: undefined }, savedChartsContextRef: { current: '' },
    loadSavedChartsList: async () => { if (contextError) throw Error('offline'); return []; },
    detectTargetSavedChart: () => null, RELATIONSHIP_REGEX: /relationship/,
    extractDateFromMessage: async () => null, chartContextRef: { current: '' },
    base44: { agents: { addMessage: async (_chat, message) => {
      state.calls++;
      assert.equal(message.content, 'hello');
      state.input = newerDraft;
      if (error) throw error;
    } } },
  });
  await send();
  return state;
}

test('Navigator restores drafts and clears sending after quota, upgrade, network or context failure', async () => {
  for (const [code, message] of [['limit_reached', /AI limit/], ['upgrade_required', /Core or Premium/], [undefined, /try again/]]) {
    const state = await runSend({ error: Object.assign(Error('failed'), { code }) });
    assert.equal(state.sending, false);
    assert.equal(state.input, 'hello');
    assert.match(state.error, message);
  }
  const contextFailure = await runSend({ contextError: true });
  assert.equal(contextFailure.sending, false);
  assert.equal(contextFailure.input, 'hello');
  assert.equal(contextFailure.calls, 0);
  const newer = await runSend({ error: Error('failed'), newerDraft: 'new question' });
  assert.equal(newer.input, 'new question');
});

test('Navigator successful sends still clear the input and busy state', async () => {
  const state = await runSend();
  assert.deepEqual(state, { input: '', sending: false, error: '', calls: 1 });
});
