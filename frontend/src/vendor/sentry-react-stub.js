export function init() {}
export function captureException() {}
export function captureMessage() {}
export function addBreadcrumb() {}
export function setTag() {}
export function setContext() {}

const Sentry = {
  init,
  captureException,
  captureMessage,
  addBreadcrumb,
  setTag,
  setContext,
};

export default Sentry;
