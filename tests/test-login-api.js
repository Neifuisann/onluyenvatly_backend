const axios = require('axios');

async function testLogin() {
  try {
    // Step 1: Get CSRF token
    console.log('Step 1: Getting CSRF token...');
    const csrfResponse = await axios.get('http://localhost:3003/api/csrf-token', {
      withCredentials: true,
    });
    
    console.log('CSRF Response:', csrfResponse.data);
    const csrfToken = csrfResponse.data.csrfToken;
    const cookies = csrfResponse.headers['set-cookie'];
    
    // Step 2: Login with CSRF token
    console.log('\nStep 2: Attempting login...');
    const loginResponse = await axios.post(
      'http://localhost:3003/api/auth/login',
      {
        phone_number: '0375931007',
        password: '140207',
        deviceId: 'test-device-123'
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
          'Cookie': cookies
        },
        withCredentials: true
      }
    );
    
    console.log('Login successful:', loginResponse.data);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Headers:', error.response.headers);
    }
  }
}

testLogin();