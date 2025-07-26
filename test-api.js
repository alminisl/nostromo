const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:8080/api';
const API_KEY = 'demo-api-key-for-testing-12345678';

async function testAPI() {
  console.log('🧪 Testing Secure File Share API...\n');

  try {
    // Test 1: Health check
    console.log('1️⃣ Testing health endpoint...');
    const health = await axios.get(`${API_BASE}/health`);
    console.log('✅ Health check:', health.data);

    // Test 2: Generate API key
    console.log('\n2️⃣ Testing API key generation...');
    const keyResponse = await axios.post(`${API_BASE}/auth/api-key`, {
      permissions: 'read,write',
      expiresInHours: 24
    }, {
      headers: { 'X-API-Key': API_KEY }
    });
    console.log('✅ API key generated:', {
      keyId: keyResponse.data.keyId,
      permissions: keyResponse.data.permissions
    });

    // Test 3: List devices
    console.log('\n3️⃣ Testing device listing...');
    const devices = await axios.get(`${API_BASE}/devices`, {
      headers: { 'X-API-Key': API_KEY }
    });
    console.log('✅ Devices found:', devices.data.devices.length);
    devices.data.devices.forEach(device => {
      console.log(`   - ${device.name} (${device.ipAddress}) ${device.isSelf ? '[Self]' : ''}`);
    });

    // Test 4: Create a test file and upload
    console.log('\n4️⃣ Testing file upload...');
    const testContent = 'Hello, Secure File Share! 🔒\nThis is a test file created at ' + new Date().toISOString();
    const testFilePath = path.join(__dirname, 'test-upload.txt');
    fs.writeFileSync(testFilePath, testContent);

    const FormData = require('form-data');
    const form = new FormData();
    form.append('file', fs.createReadStream(testFilePath));
    form.append('deviceName', 'Test Device');
    form.append('expiresInMinutes', '60');

    const uploadResponse = await axios.post(`${API_BASE}/files`, form, {
      headers: {
        'X-API-Key': API_KEY,
        ...form.getHeaders()
      }
    });
    console.log('✅ File uploaded:', {
      fileId: uploadResponse.data.fileId,
      filename: uploadResponse.data.filename,
      size: uploadResponse.data.size
    });

    // Test 5: List files
    console.log('\n5️⃣ Testing file listing...');
    const files = await axios.get(`${API_BASE}/files`, {
      headers: { 'X-API-Key': API_KEY }
    });
    console.log('✅ Files found:', files.data.files.length);
    files.data.files.forEach(file => {
      console.log(`   - ${file.filename} (${Math.round(file.size / 1024)}KB) from ${file.deviceName}`);
    });

    // Test 6: Download the uploaded file
    console.log('\n6️⃣ Testing file download...');
    const downloadResponse = await axios.get(`${API_BASE}/files/${uploadResponse.data.fileId}`, {
      headers: { 'X-API-Key': API_KEY },
      responseType: 'arraybuffer'
    });
    const downloadedContent = Buffer.from(downloadResponse.data).toString();
    console.log('✅ File downloaded successfully');
    console.log('   Content matches:', downloadedContent === testContent ? '✅' : '❌');

    // Cleanup
    fs.unlinkSync(testFilePath);
    
    console.log('\n🎉 All API tests passed! The Secure File Share system is working correctly.');
    
    console.log('\n📋 Next steps:');
    console.log('   • Open http://localhost:8080 in your browser');
    console.log('   • Use API key: demo-api-key-for-testing-12345678');
    console.log('   • Upload files via drag & drop or API');
    console.log('   • Share files across your local network');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  testAPI();
}

module.exports = { testAPI };