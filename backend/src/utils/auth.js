const crypto = require('crypto');
const { authenticator } = require('otplib');

const hashPin = (pin) => {
  // Use SHA-256 for backward compatibility with Python backend
  return crypto.createHash('sha256').update(pin).digest('hex');
};

const verifyPin = (pin, hash) => {
  return hashPin(pin) === hash;
};

const generateTotpSecret = () => {
  return authenticator.generateSecret(32);
};

const verifyTotp = (secret, token) => {
  // Allow ±2 timestep tolerance (allows ~90s window)
  authenticator.options = { window: 2 };
  return authenticator.verify({ token, secret });
};

const generateProvisioningUri = (secret, accountName, issuer = 'CareHome Clocking') => {
  return authenticator.keyuri(accountName, issuer, secret);
};

module.exports = {
  hashPin,
  verifyPin,
  generateTotpSecret,
  verifyTotp,
  generateProvisioningUri
};
