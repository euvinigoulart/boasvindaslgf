import fetch from 'node-fetch';

async function test() {
  const scriptUrl = process.env.GOOGLE_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbxin3v_CEMXweTsVG44Fo2J7Wzu9biukv8SGVavHuoKPVJGh5_OahRMRwXTQhR_smWn/exec';
  const url = new URL(scriptUrl);
  url.searchParams.append('action', 'getVolunteers');
  url.searchParams.append('_t', Date.now().toString());
  
  console.log('Fetching:', url.toString());
  const response = await fetch(url.toString(), {
    method: 'GET',
    redirect: 'follow'
  });
  
  console.log('Status:', response.status);
  const text = await response.text();
  console.log('Response:', text.substring(0, 200));
}

test();
