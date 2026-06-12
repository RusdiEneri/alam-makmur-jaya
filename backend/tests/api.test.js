const test = require('node:test');
const assert = require('node:assert');
const http = require('http');

// Assuming server is started locally for tests
const BASE_URL = 'http://localhost:3000/api';

test('Health Check Endpoint', async (t) => {
  const res = await fetch(`${BASE_URL}/health`);
  assert.strictEqual(res.status, 200, 'HTTP status is 200');
  const data = await res.json();
  assert.strictEqual(data.status, 'OK', 'Status is OK');
});

test('Checkout Validation: Empty Cart', async (t) => {
  const res = await fetch(`${BASE_URL}/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      namaPembeli: 'Tester',
      noWhatsapp: '081234567890',
      alamatPengiriman: 'Jl Test',
      items: [],
      metodeBayar: 'cod'
    })
  });
  
  assert.strictEqual(res.status, 400, 'Empty cart should be rejected with 400');
  const data = await res.json();
  assert.ok(data.message.toLowerCase().includes('keranjang'), 'Error message mentions keranjang');
});

test('Checkout Validation: Missing Buyer Info', async (t) => {
  const res = await fetch(`${BASE_URL}/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      namaPembeli: '',
      noWhatsapp: '',
      alamatPengiriman: '',
      items: [{ productId: 'test', qty: 1 }],
      metodeBayar: 'cod'
    })
  });
  
  assert.strictEqual(res.status, 400, 'Missing buyer info should be rejected with 400');
  const data = await res.json();
  assert.ok(data.message.toLowerCase().includes('lengkap'), 'Error message mentions data belum lengkap');
});
