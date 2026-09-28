// All settings come from the environment (12-factor). Locally, .env fills them in.
require('dotenv').config({ quiet: true });

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set — copy server/.env.example to server/.env and fill it in`);
  }
  return value;
}

module.exports = {
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
};
