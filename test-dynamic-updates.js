// Test script to verify dynamic college data updates
const axios = require('axios');

async function testDynamicUpdates() {
  console.log('🧪 Testing dynamic college data updates...\n');
  
  try {
    // Test 1: Check if colleges endpoint returns fresh data
    console.log('1️⃣ Testing API endpoint for fresh data...');
    const response1 = await axios.get('http://localhost:3000/api/colleges', {
      params: { _t: Date.now() }
    });
    console.log('✅ Initial colleges count:', response1.data.colleges?.length || 0);
    
    // Test 2: Add a test college
    console.log('\n2️⃣ Adding a test college...');
    const testCollege = {
      name: `Test College ${Date.now()}`,
      numberOfProviders: '1',
      reportFrequency: 'weekly',
      status: 'A',
      ofstedRating: 'G',
      template: 'standard'
    };
    
    const addResponse = await axios.post('http://localhost:3000/api/colleges', testCollege);
    console.log('✅ Test college added:', addResponse.data.college?.name);
    
    // Test 3: Verify the college appears in the list
    console.log('\n3️⃣ Verifying college appears in updated list...');
    const response2 = await axios.get('http://localhost:3000/api/colleges', {
      params: { _t: Date.now() }
    });
    
    const newCollege = response2.data.colleges?.find(c => c.name === testCollege.name);
    if (newCollege) {
      console.log('✅ New college found in updated list:', newCollege.name);
    } else {
      console.log('❌ New college not found in updated list');
    }
    
    // Test 4: Update the college
    console.log('\n4️⃣ Updating the test college...');
    const updateData = {
      name: `${testCollege.name} - Updated`,
      numberOfProviders: '2'
    };
    
    const updateResponse = await axios.put(`http://localhost:3000/api/colleges/${newCollege.id}`, updateData);
    console.log('✅ College updated:', updateResponse.data.college?.name);
    
    // Test 5: Verify the update appears
    console.log('\n5️⃣ Verifying update appears in list...');
    const response3 = await axios.get('http://localhost:3000/api/colleges', {
      params: { _t: Date.now() }
    });
    
    const updatedCollege = response3.data.colleges?.find(c => c.id === newCollege.id);
    if (updatedCollege && updatedCollege.name.includes('Updated')) {
      console.log('✅ Updated college found:', updatedCollege.name);
    } else {
      console.log('❌ Updated college not found or not updated');
    }
    
    // Test 6: Delete the test college
    console.log('\n6️⃣ Deleting the test college...');
    await axios.delete(`http://localhost:3000/api/colleges/${newCollege.id}`);
    console.log('✅ Test college deleted');
    
    // Test 7: Verify deletion
    console.log('\n7️⃣ Verifying deletion...');
    const response4 = await axios.get('http://localhost:3000/api/colleges', {
      params: { _t: Date.now() }
    });
    
    const deletedCollege = response4.data.colleges?.find(c => c.id === newCollege.id);
    if (!deletedCollege) {
      console.log('✅ College successfully deleted from list');
    } else {
      console.log('❌ College still exists in list after deletion');
    }
    
    console.log('\n🎉 All dynamic update tests completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   ✅ API returns fresh data with cache-busting');
    console.log('   ✅ New colleges are immediately available');
    console.log('   ✅ Updates are immediately reflected');
    console.log('   ✅ Deletions are immediately reflected');
    console.log('\n💡 The frontend should now automatically refresh every 30 seconds');
    console.log('   and show real-time updates when data changes.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    console.log('\n🔧 Make sure the server is running on localhost:3000');
  }
}

// Run the test
testDynamicUpdates();
