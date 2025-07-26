const forge = require('node-forge');
const fs = require('fs');
const path = require('path');

function getLocalIPs() {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  const ips = [];
  
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips.length > 0 ? ips : ['127.0.0.1'];
}

function getLocalIP() {
  return getLocalIPs()[0];
}

async function generateSelfSignedCert() {
  console.log('Generating self-signed certificate...');
  const localIPs = getLocalIPs();
  console.log(`Including local IPs: ${localIPs.join(', ')}`);
  
  // Create a keypair
  const keys = forge.pki.rsa.generateKeyPair(2048);
  
  // Create a certificate
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
  
  const attrs = [
    { name: 'countryName', value: 'US' },
    { name: 'organizationName', value: 'Secure File Share' },
    { name: 'organizationalUnitName', value: 'Development' },
    { name: 'commonName', value: 'localhost' }
  ];
  
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  
  // Add extensions
  cert.setExtensions([
    {
      name: 'basicConstraints',
      cA: true
    },
    {
      name: 'keyUsage',
      keyCertSign: true,
      digitalSignature: true,
      nonRepudiation: true,
      keyEncipherment: true,
      dataEncipherment: true
    },
    {
      name: 'extKeyUsage',
      serverAuth: true,
      clientAuth: true,
      codeSigning: true,
      timeStamping: true
    },
    {
      name: 'nsCertType',
      server: true,
      client: true,
      email: true,
      objsign: true
    },
    {
      name: 'subjectAltName',
      altNames: [
        { type: 2, value: 'localhost' }, // DNS
        { type: 2, value: '*.localhost' },
        { type: 7, ip: '127.0.0.1' }, // IP
        { type: 7, ip: '::1' },
        // Add all local network IPs
        ...localIPs.map(ip => ({ type: 7, ip })),
        ...localIPs.map(ip => ({ type: 2, value: ip }))
      ]
    }
  ]);
  
  // Self-sign certificate
  cert.sign(keys.privateKey);
  
  // Convert to PEM format
  const certPem = forge.pki.certificateToPem(cert);
  const keyPem = forge.pki.privateKeyToPem(keys.privateKey);
  
  return { cert: certPem, key: keyPem };
}

async function initializeCertificates(certsDir) {
  const certPath = path.join(certsDir, 'cert.pem');
  const keyPath = path.join(certsDir, 'key.pem');
  
  // Check if certificates already exist
  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    console.log('Using existing certificates');
    return {
      cert: fs.readFileSync(certPath, 'utf8'),
      key: fs.readFileSync(keyPath, 'utf8')
    };
  }
  
  // Generate new certificates
  const { cert, key } = await generateSelfSignedCert();
  
  // Save certificates
  fs.writeFileSync(certPath, cert);
  fs.writeFileSync(keyPath, key);
  
  console.log('Generated and saved new certificates');
  console.log('Certificate fingerprint for manual verification:');
  
  // Generate fingerprint
  const certObj = forge.pki.certificateFromPem(cert);
  const der = forge.asn1.toDer(forge.pki.certificateToAsn1(certObj)).getBytes();
  const hash = forge.md.sha256.create();
  hash.update(der);
  const fingerprint = hash.digest().toHex().match(/.{2}/g).join(':').toUpperCase();
  console.log(`SHA256: ${fingerprint}`);
  
  return { cert, key };
}

function getCertificateFingerprint(certPem) {
  const certObj = forge.pki.certificateFromPem(certPem);
  const der = forge.asn1.toDer(forge.pki.certificateToAsn1(certObj)).getBytes();
  const hash = forge.md.sha256.create();
  hash.update(der);
  return hash.digest().toHex();
}

module.exports = {
  initializeCertificates,
  getCertificateFingerprint,
  generateSelfSignedCert
};