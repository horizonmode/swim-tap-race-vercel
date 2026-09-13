// A page-memory credential survives socket reconnects, but never a page refresh.
export function createPresenterSession(send) {
  let key = '';
  return {
    authenticate(value) {
      if (!send('presenter:auth', { key: value })) return false;
      key = value;
      return true;
    },
    reconnect() { if (key) send('presenter:auth', { key }); },
    clear() { key = ''; }
  };
}
