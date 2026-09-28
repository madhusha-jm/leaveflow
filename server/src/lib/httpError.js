// An Error carrying an HTTP status and a machine-readable code.
// The error middleware in app.js turns it into { error: { code, message } }.
function httpError(status, code, message) {
  const e = new Error(message);
  e.status = status;
  e.code = code;
  return e;
}

module.exports = httpError;
