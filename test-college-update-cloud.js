const axios = require('axios');

// Test configuration for cloud
const BASE_URL = 'https://am-reports-hub-production.up.railway.app';
const TEST_USER = { username: 'admin', password: 'admin123' };

// Store the token manually
let authToken = null;

async function testCollegeUpdateCloud() {
  try {
    console.log('🧪 Testing College Update functionality on CLOUD...\n');

    // Step 1: Login
    console.log('1️⃣ Logging in to cloud...');
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, TEST_USER, {
      withCredentials: true
    });
    
    if (!loginResponse.data.success) {
      throw new Error('Login failed: ' + loginResponse.data.error);
    }
    
    console.log('✅ Login successful');
    
    // Extract token from cookie
    const cookies = loginResponse.headers['set-cookie'];
    if (cookies) {
      const tokenCookie = cookies.find(cookie => cookie.startsWith('token='));
      if (tokenCookie) {
        authToken = tokenCookie.split(';')[0].split('=')[1];
        console.log('Token extracted:', authToken.substring(0, 20) + '...');
      }
    }

    // Step 2: Get colleges
    console.log('\n2️⃣ Getting colleges from cloud...');
    const collegesResponse = await axios.get(`${BASE_URL}/api/colleges`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    if (!collegesResponse.data || collegesResponse.data.length === 0) {
      throw new Error('No colleges found');
    }
    
    const college = collegesResponse.data[0];
    console.log('✅ Found college:', college.name, '(ID:', college.id, ')');

    // Step 3: Update college
    console.log('\n3️⃣ Updating college on cloud...');
    const updateData = {
      name: college.name + ' (Cloud Updated)',
      numberOfProviders: '3',
      reportFrequency: 'weekly',
      dataTransferMethod: 'Cloud Upload',
      misContactName: 'Cloud Contact',
      misContactEmail: 'cloud@example.com',
      renewalDate: '2026-01-31'
    };
    
    console.log('Update data:', updateData);
    
    const updateResponse = await axios.put(`${BASE_URL}/api/colleges/${college.id}`, updateData, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (updateResponse.data.success) {
      console.log('✅ College updated successfully on cloud');
      console.log('Updated college:', updateResponse.data.college);
    } else {
      console.log('❌ College update failed:', updateResponse.data.error);
    }

    // Step 4: Get college again to verify persistence
    console.log('\n4️⃣ Verifying persistence on cloud...');
    const getCollegeResponse = await axios.get(`${BASE_URL}/api/colleges/${college.id}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    if (getCollegeResponse.data.success) {
      const updatedCollege = getCollegeResponse.data.college;
      console.log('✅ College data retrieved successfully from cloud');
      console.log('Retrieved college:', updatedCollege);
      
      // Check if the update persisted
      if (updatedCollege.name === updateData.name) {
        console.log('✅ Update persisted correctly on cloud!');
      } else {
        console.log('❌ Update did not persist on cloud!');
        console.log('Expected name:', updateData.name);
        console.log('Actual name:', updatedCollege.name);
      }
    } else {
      console.log('❌ Failed to retrieve college:', getCollegeResponse.data.error);
    }

    console.log('\n🎉 Cloud college update test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('   Response data:', error.response.data);
      console.error('   Status:', error.response.status);
    }
  }
}

// Run the test
testCollegeUpdateCloud(); 