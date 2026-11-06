'use strict';

const assert = require('node:assert/strict');
const { createLanguageSelection } = require('../../contexts/languageSelection');

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function setup(load = async () => true, persist = async () => {}) {
  const applied = [];
  const saved = [];
  const selection = createLanguageSelection({
    load,
    apply: (code) => applied.push(code),
    persist: async (code) => { await persist(code); saved.push(code); },
  });
  return { selection, applied, saved };
}

async function main() {
  // Downloads complete in reverse order: the last click still wins.
  {
    const tr = deferred();
    const s = setup((code) => code === 'tr' ? tr.promise : Promise.resolve(true));
    const first = s.selection.select('tr');
    await s.selection.select('de');
    tr.resolve(true);
    await first;
    assert.deepEqual(s.applied, ['de']);
    assert.deepEqual(s.saved, ['de']);
  }

  // The loading timeout can expose the UI while a saved-setting IPC read
  // is still pending. That read must not undo a user's explicit choice.
  {
    const saved = deferred();
    const s = setup();
    const startup = s.selection.initialize(() => saved.promise);
    await s.selection.select('tr');
    saved.resolve('ar');
    await startup;
    assert.deepEqual(s.applied, ['tr']);
    assert.deepEqual(s.saved, ['tr']);
  }

  // Startup may also be waiting on a dictionary rather than on IPC.
  {
    const loading = deferred();
    const started = deferred();
    const s = setup((code) => {
      if (code === 'ar') { started.resolve(); return loading.promise; }
      return Promise.resolve(true);
    });
    const startup = s.selection.initialize(async () => 'ar');
    await started.promise;
    await s.selection.select('tr');
    loading.resolve(true);
    await startup;
    assert.deepEqual(s.applied, ['tr']);
  }

  // An already-started write cannot be cancelled. The next write waits
  // for it so both the tray and the next launch end in the latest language.
  {
    const writing = deferred();
    const started = deferred();
    const calls = [];
    const s = setup(undefined, async (code) => {
      calls.push(code);
      if (code === 'tr') { started.resolve(); await writing.promise; }
    });
    const first = s.selection.select('tr');
    await started.promise;
    const second = s.selection.select('ar');
    const third = s.selection.select('de');
    assert.deepEqual(calls, ['tr']);
    writing.resolve();
    await Promise.all([first, second, third]);
    assert.deepEqual(s.saved, ['tr', 'de']);
    assert.equal(s.applied.at(-1), 'de');
  }

  // A rejected settings write does not poison the queue.
  {
    const s = setup(undefined, async (code) => { if (code === 'tr') throw new Error('IPC failed'); });
    await s.selection.select('tr');
    await s.selection.select('de');
    assert.deepEqual(s.saved, ['de']);
    assert.deepEqual(s.applied, ['tr', 'de']);
  }

  // Failed downloads leave an existing choice alone; startup falls back
  // to English without persisting an automatically detected preference.
  {
    const s = setup(async (code) => code !== 'tr');
    await s.selection.select('de');
    await s.selection.select('tr');
    assert.deepEqual(s.applied, ['de']);
    assert.deepEqual(s.saved, ['de']);
    await s.selection.initialize(async () => 'tr');
    assert.deepEqual(s.applied, ['de', 'en']);
    assert.deepEqual(s.saved, ['de']);
  }

  // Unmount invalidates pending work. A subsequent effect (React Strict
  // Mode) can initialize the same controller again.
  {
    const loading = deferred();
    const s = setup((code) => code === 'tr' ? loading.promise : Promise.resolve(true));
    const old = s.selection.select('tr');
    s.selection.cancel();
    await s.selection.initialize(async () => 'de');
    loading.resolve(true);
    await old;
    assert.deepEqual(s.applied, ['de']);
    assert.deepEqual(s.saved, []);
  }

  console.log('language-selection: 7 scenarios passed');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
