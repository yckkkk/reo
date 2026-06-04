(function () {
  if (window.reo) {
    return;
  }

  var nextId = 0;
  var MAX_PENDING_REQUESTS = 64;
  var REQUEST_TIMEOUT_MS = 30000;
  var pending = new Map();

  function createRequestId() {
    nextId += 1;
    return 'reo_' + Date.now().toString(36) + '_' + nextId.toString(36);
  }

  function runtimeError(error) {
    var message = error && error.message ? error.message : 'Reo runtime request failed';
    var wrapped = new Error(message);
    if (error && error.code) {
      wrapped.code = error.code;
    }
    return wrapped;
  }

  window.addEventListener('message', function (event) {
    var data = event.data;
    if (event.source !== window.parent) {
      return;
    }
    if (!data || data.source !== 'reo-host' || data.type !== 'response') {
      return;
    }
    var entry = pending.get(data.requestId);
    if (!entry) {
      return;
    }
    pending.delete(data.requestId);
    window.clearTimeout(entry.timeoutId);
    if (data.ok) {
      entry.resolve(data.value);
      return;
    }
    entry.reject(runtimeError(data.error));
  });

  function call(method, payload) {
    var requestId = createRequestId();
    return new Promise(function (resolve, reject) {
      if (pending.size >= MAX_PENDING_REQUESTS) {
        reject(
          runtimeError({
            code: 'ERR_REO_RUNTIME_BUSY',
            message: 'Too many Reo runtime requests',
          })
        );
        return;
      }
      var timeoutId = window.setTimeout(function () {
        pending.delete(requestId);
        reject(
          runtimeError({
            code: 'ERR_REO_RUNTIME_TIMEOUT',
            message: 'Reo runtime request timed out',
          })
        );
      }, REQUEST_TIMEOUT_MS);
      pending.set(requestId, { resolve: resolve, reject: reject, timeoutId: timeoutId });
      window.parent.postMessage(
        {
          source: 'reo-runtime',
          type: 'request',
          requestId: requestId,
          method: method,
          payload: payload,
        },
        '*'
      );
    });
  }

  window.reo = {
    call: call,
    state: {
      read: function () {
        return call('state.read');
      },
      write: function (state, options) {
        return call('state.write', {
          state: state,
          baselineVersion: options && options.baselineVersion,
        });
      },
    },
    workspace: {
      read: function () {
        return call('workspace.read');
      },
    },
    content: {
      readMemoryDetail: function () {
        return call('content.readMemoryDetail');
      },
      readCurrentObject: function () {
        return call('content.readCurrentObject');
      },
    },
    mutations: {
      updateTitle: function (input) {
        return call('mutations.updateTitle', input);
      },
    },
    secrets: {
      list: function () {
        return call('secrets.list');
      },
      get: function (slotId) {
        return call('secrets.get', { slotId: slotId });
      },
      set: function (slotId, value) {
        return call('secrets.set', { slotId: slotId, value: value });
      },
      clear: function (slotId) {
        return call('secrets.clear', { slotId: slotId });
      },
    },
    ui: {
      requestFullscreen: function () {
        return call('ui.requestFullscreen');
      },
    },
    agent: {
      copyPrompt: function (input) {
        return call('agent.copyPrompt', {
          action: input && input.action,
        });
      },
    },
  };
})();
