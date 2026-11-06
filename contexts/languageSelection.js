'use strict';

/* Dictionary downloads and settings IPC can finish in any order. Only the
 * latest request may change the window; serialize writes so an older IPC
 * call cannot leave the tray (or the next launch) in a different language. */
function createLanguageSelection({ load, apply, persist }) {
  let revision = 0;
  let writes = Promise.resolve();

  return {
    async initialize(resolve) {
      const request = ++revision;
      let code = await resolve();
      if (request !== revision) return;
      if (!(await load(code))) code = 'en';
      if (request === revision) apply(code);
    },

    async select(code) {
      const request = ++revision;
      if (!(await load(code)) || request !== revision) return;
      apply(code);
      writes = writes.catch(() => {}).then(async () => {
        if (request === revision) await persist(code);
      });
      // A failed settings write must not reject an event handler or block
      // later selections from being saved.
      await writes.catch(() => {});
    },

    cancel() { revision += 1; },
  };
}

module.exports = { createLanguageSelection };
