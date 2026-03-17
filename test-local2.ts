import fetch from 'node-fetch';

async function test() {
  try {
    const res = await fetch('http://localhost:3000/api/services');
    console.log('Status:', res.status);
    console.log('Headers:', res.headers.raw());
    const text = await res.text();
    console.log('Response:', text.substring(0, 500));
  } catch (e) {
    console.error('Error:', e);
  }
}

test();
