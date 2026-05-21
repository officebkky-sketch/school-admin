async function listModels() {
  const apiKey = 'AIzaSyDI9MGqOIekTjW9E7K0AmaRtMnSuJyeauE';
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.error) {
      console.error('Error:', data.error);
    } else {
      console.log('Available Models:', data.models.map(m => m.name));
    }
  } catch (err) {
    console.error('Fetch Error:', err);
  }
}

listModels();
