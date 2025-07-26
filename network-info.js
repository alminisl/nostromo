#!/usr/bin/env node

const os = require('os');

function getNetworkInfo() {
  const interfaces = os.networkInterfaces();
  const networkInfo = [];
  
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        networkInfo.push({
          interface: name,
          ip: iface.address,
          subnet: iface.netmask,
          mac: iface.mac
        });
      }
    }
  }
  return networkInfo;
}

function getNetworkRange(ip, netmask) {
  const ipParts = ip.split('.').map(Number);
  const maskParts = netmask.split('.').map(Number);
  
  const network = ipParts.map((part, i) => part & maskParts[i]);
  const broadcast = network.map((part, i) => part | (~maskParts[i] & 255));
  
  return `${network.join('.')}-${broadcast.join('.')}`;
}

console.log('🌐 Network Information for Secure File Share\n');

const networkInfo = getNetworkInfo();

if (networkInfo.length === 0) {
  console.log('❌ No network interfaces found. Make sure you\'re connected to a network.');
  process.exit(1);
}

console.log('📡 Available Network Interfaces:');
networkInfo.forEach((info, index) => {
  console.log(`\n${index + 1}. ${info.interface}`);
  console.log(`   IP Address: ${info.ip}`);
  console.log(`   Subnet: ${info.subnet}`);
  console.log(`   MAC Address: ${info.mac}`);
  console.log(`   Network Range: ${getNetworkRange(info.ip, info.subnet)}`);
  console.log(`   🔗 Access URL: https://${info.ip}:8080`);
});

const primaryIP = networkInfo[0].ip;
console.log('\n🎯 Primary Access Information:');
console.log(`   Main URL: https://${primaryIP}:8080`);
console.log(`   HTTP Redirect: http://${primaryIP}:3000`);
console.log(`   API Endpoint: https://${primaryIP}:8080/api`);

console.log('\n📱 For Mobile Devices:');
console.log(`   1. Connect to the same WiFi network`);
console.log(`   2. Open browser and go to: https://${primaryIP}:8080`);
console.log(`   3. Accept the certificate warning`);
console.log(`   4. Use API key: demo-api-key-for-testing-12345678`);

console.log('\n🔧 API Test Commands:');
console.log(`   curl -k -H "X-API-Key: demo-api-key-for-testing-12345678" https://${primaryIP}:8080/api/health`);
console.log(`   curl -k -H "X-API-Key: demo-api-key-for-testing-12345678" https://${primaryIP}:8080/api/files`);

console.log('\n🔒 Security Notes:');
console.log('   • Uses HTTPS with self-signed certificates');
console.log('   • All file transfers are encrypted end-to-end');
console.log('   • Only works within your local network');
console.log('   • No external internet connection required');

console.log('\n💡 Troubleshooting:');
console.log('   • If connection fails, check firewall settings');
console.log('   • Make sure port 8080 is not blocked');
console.log('   • Ensure all devices are on the same network');
console.log('   • Certificate warnings are normal for self-signed certs');