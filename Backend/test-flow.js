/**
 * End-to-End Automated Test Script for Dukatrack MVP Backend & Constraints
 */

const http = require('http');

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : '';
    const req = http.request(
      {
        hostname: 'localhost',
        port: 3000,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve({ statusCode: res.statusCode, body: parsed });
          } catch {
            resolve({ statusCode: res.statusCode, body: data });
          }
        });
      }
    );
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('--- STARTING DUKATRACK BACKEND E2E TEST ---');

  // 1. Create Delivery Request as Retailer
  const createRes = await request('POST', '/requests', {
    retailer_id: 'ret-101',
    customer_name: 'Juma Hassan',
    customer_phone: '+254711223344',
    customer_address: 'Mombasa Road, Nairobi',
    item_description: '2x Fresh Avocado Crates',
  });

  console.log('1. Create Request Status:', createRes.statusCode);
  if (createRes.statusCode !== 201) throw new Error('Create failed: ' + JSON.stringify(createRes.body));
  const delivery = createRes.body;
  console.log('   Delivery ID:', delivery.id);
  console.log('   QR Token Generated:', delivery.qr_code_token);
  console.log('   Status:', delivery.status);

  // 2. Assign Rider as Dispatcher
  const assignRes = await request('POST', `/requests/${delivery.id}/assign`, {
    riderId: 'rider-301',
    dispatcherId: 'disp-201',
  });
  console.log('2. Assign Rider Status:', assignRes.statusCode);
  if (assignRes.statusCode !== 200) throw new Error('Assign failed: ' + JSON.stringify(assignRes.body));
  console.log('   Assigned Rider ID:', assignRes.body.assigned_rider_id);
  console.log('   New Status:', assignRes.body.status);

  // 3. Attempt Manual Transition to DELIVERED (MUST FAIL WITH 400)
  const illegalStatusRes = await request('POST', `/requests/${delivery.id}/status`, {
    newStatus: 'DELIVERED',
    riderId: 'rider-301',
  });
  console.log('3. Manual DELIVERED attempt HTTP Status:', illegalStatusRes.statusCode);
  if (illegalStatusRes.statusCode === 400) {
    console.log('   SUCCESS: Correctly rejected manual transition to DELIVERED!');
    console.log('   Error Message:', illegalStatusRes.body.error);
  } else {
    throw new Error('FAILURE: Server allowed manual transition to DELIVERED!');
  }

  // 4. Update Status to PICKED_UP (Valid manual update)
  const pickedUpRes = await request('POST', `/requests/${delivery.id}/status`, {
    newStatus: 'PICKED_UP',
    riderId: 'rider-301',
  });
  console.log('4. Picked Up HTTP Status:', pickedUpRes.statusCode);
  if (pickedUpRes.statusCode !== 200) throw new Error('Picked Up failed: ' + JSON.stringify(pickedUpRes.body));
  console.log('   New Status:', pickedUpRes.body.status);

  // 5. Attempt QR Confirmation with Invalid Token (MUST FAIL WITH 400)
  const badQrRes = await request('POST', `/requests/${delivery.id}/confirm-delivery`, {
    scannedToken: 'WRONG-TOKEN-999',
    riderId: 'rider-301',
  });
  console.log('5. Bad QR Confirm HTTP Status:', badQrRes.statusCode);
  if (badQrRes.statusCode === 400) {
    console.log('   SUCCESS: Correctly rejected invalid QR token!');
    console.log('   Error Message:', badQrRes.body.error);
  } else {
    throw new Error('FAILURE: Server accepted invalid QR token!');
  }

  // 6. Confirm Delivery with Valid QR Token (MUST SUCCEED)
  const validQrRes = await request('POST', `/requests/${delivery.id}/confirm-delivery`, {
    scannedToken: delivery.qr_code_token,
    riderId: 'rider-301',
  });
  console.log('6. Valid QR Confirm HTTP Status:', validQrRes.statusCode);
  if (validQrRes.statusCode !== 200) throw new Error('Valid QR confirm failed: ' + JSON.stringify(validQrRes.body));
  console.log('   Final Status:', validQrRes.body.status);

  // 7. Verify Immutable Status Event Audit History
  const historyRes = await request('GET', `/requests/${delivery.id}/history`);
  console.log('7. Audit Trail StatusEvents count:', historyRes.body.length);
  historyRes.body.forEach((ev, idx) => {
    console.log(`   [Event ${idx + 1}] ${ev.from_status || 'INIT'} -> ${ev.to_status} | Actor: ${ev.actor_role} (${ev.actor_id}) | Method: ${ev.method}`);
  });

  console.log('--- ALL E2E BACKEND TESTS PASSED PERFECTLY! ---');
}

runTests().catch((err) => {
  console.error('Test Execution Error:', err);
  process.exit(1);
});
