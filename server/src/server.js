const app = require('./app');

const PORT = Number(process.env.PORT) || 4000;

// Express 5 passes listen errors (e.g. port already taken) to this callback.
app.listen(PORT, (err) => {
  if (err) {
    console.error(err.code === 'EADDRINUSE'
      ? `Port ${PORT} is already in use — is another LeaveFlow server running?`
      : err);
    process.exit(1);
  }
  console.log(`LeaveFlow API on http://localhost:${PORT}`);
});
