/**
 * Simple utility to interface with the Gemini REST API
 */

export const generateGeminiContent = async (apiKey, prompt) => {
  if (!apiKey) {
    throw new Error('No API key provided.');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  
  const payload = {
    contents: [{
      parts: [{ text: prompt }]
    }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 500,
    }
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData?.error?.message || 'Failed to fetch from Gemini API');
    }

    const data = await response.json();
    
    // Extract text from the response
    if (data.candidates && data.candidates.length > 0) {
      const parts = data.candidates[0].content.parts;
      if (parts && parts.length > 0) {
        return parts[0].text.trim();
      }
    }
    
    return 'No response generated.';
  } catch (err) {
    console.error('Gemini API Error:', err);
    throw err;
  }
};
