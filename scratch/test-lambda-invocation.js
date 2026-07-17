import { handler } from '../lambda/index.mjs';

// Setup local test environment to point to the active SSH tunnel port (5433)
process.env.DB_HOST = '127.0.0.1';
process.env.DB_PORT = '5433';
process.env.DB_NAME = 'labeling_tool';
process.env.DB_USER = 'labeling_tool_ec2_user';
process.env.DB_PASSWORD = 'LabelingToolEc2User@019283';
process.env.ALLOWED_ORIGIN = 'http://localhost:3000';

async function test() {
  console.log('--- Testing Lambda Handler ---');

  // Test 1: Fetching all 24 segments for Armenian Public TV (1009) on 2026-06-15
  console.log('\n[Test 1] Fetching all daily slots...');
  const event1 = {
    httpMethod: 'GET',
    queryStringParameters: {
      channelId: '1009',
      date: '2026-06-15'
    }
  };
  const res1 = await handler(event1);
  console.log('Status Code:', res1.statusCode);
  const body1 = JSON.parse(res1.body);
  console.log('Records Found:', body1.records ? body1.records.length : 0);
  if (body1.records && body1.records.length > 0) {
    console.log('Sample Record:', body1.records[0]);
  }

  // Test 2: Fetching closest available recording (hour 13, channel 1009, on a non-existent day)
  console.log('\n[Test 2] Querying closest available recording...');
  const event2 = {
    httpMethod: 'GET',
    queryStringParameters: {
      channelId: '1009',
      date: '2026-07-20',
      hour: '13',
      closest: 'true'
    }
  };
  const res2 = await handler(event2);
  console.log('Status Code:', res2.statusCode);
  const body2 = JSON.parse(res2.body);
  console.log('Closest Record Found:', body2.record);

  // Test 3: OPTIONS CORS preflight
  console.log('\n[Test 3] Preflight OPTIONS request...');
  const event3 = {
    httpMethod: 'OPTIONS'
  };
  const res3 = await handler(event3);
  console.log('Status Code:', res3.statusCode);
  console.log('Headers:', res3.headers);

  // Exit cleanly
  process.exit(0);
}

test().catch(err => {
  console.error('Test Execution Failed:', err);
  process.exit(1);
});
