#!/usr/bin/env node

const path = require('path');
const { spawn } = require('child_process');

console.log('🚀 Starting Secure File Share Demo...\n');

// Start the server
const serverProcess = spawn('node', ['server/index.js'], {
  cwd: __dirname,
  stdio: 'inherit'
});

// Get local IP address
const os = require('os');
function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const ips = ['localhost'];
  
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
}

const ips = getLocalIPs();
console.log('📋 Access Information:');
ips.forEach(ip => {
  console.log(`   • 🌟 Public File Share: https://${ip}:8080`);
  if (ip !== 'localhost') {
    console.log(`     (No API key needed - perfect for sharing!)`);
  }
});
console.log(`   • 🔧 Admin Interface: https://${ips[1] || 'localhost'}:8080/admin`);
console.log('   • Demo API Key: demo-api-key-for-testing-12345678 (for admin only)');

console.log('\n🎉 New Features:');
console.log('   ✅ No API key required for file sharing!');
console.log('   ✅ Beautiful Wormhole-style interface');
console.log('   ✅ Direct share links with QR codes');
console.log('   ✅ One-click download from any device');
console.log('   ✅ Admin interface for management (separate)');

console.log('\n⚠️  Security Note:');
console.log('   • You\'ll see a certificate warning - click "Advanced" → "Proceed" to continue');
console.log('   • This is expected for self-signed certificates on local networks\n');

console.log('🔧 Quick API Test Commands (use -k to ignore certificate warnings):');
console.log('   # Upload a file');
console.log('   curl -k -X POST -H "X-API-Key: demo-api-key-for-testing-12345678" -F "file=@yourfile.txt" https://192.168.1.205:8080/api/files\n');
console.log('   # List files');
console.log('   curl -k -H "X-API-Key: demo-api-key-for-testing-12345678" https://192.168.1.205:8080/api/files\n');

console.log('Press Ctrl+C to stop the server\n');

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Stopping server...');
  serverProcess.kill('SIGTERM');
  setTimeout(() => {
    serverProcess.kill('SIGKILL');
    process.exit(0);
  }, 5000);
});

serverProcess.on('exit', (code) => {
  console.log(`\n✅ Server stopped with code ${code}`);
  process.exit(code);
});