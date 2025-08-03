// Copy this code into your Cloudflare Worker script

export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Content-Type': 'application/json'
    };

    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Check if the request method is POST
      if (request.method !== 'POST') {
        return new Response(JSON.stringify({
          error: 'Method not allowed'
        }), {
          status: 405,
          headers: corsHeaders
        });
      }

      // Verify API key exists
      const apiKey = env.OPENAI_API_KEY;
      if (!apiKey) {
        return new Response(JSON.stringify({
          error: 'Server configuration error: API key not found'
        }), {
          status: 500,
          headers: corsHeaders
        });
      }

      // Parse the request body
      const userInput = await request.json();
      
      // Validate input
      if (!userInput.messages || !Array.isArray(userInput.messages)) {
        return new Response(JSON.stringify({
          error: 'Invalid request: messages array is required'
        }), {
          status: 400,
          headers: corsHeaders
        });
      }

      const apiUrl = 'https://api.openai.com/v1/chat/completions';
      
      // Optimize the message context
      const optimizedMessages = userInput.messages.map(msg => ({
        ...msg,
        // Trim long messages to essential content
        content: msg.content.length > 500 ? msg.content.slice(0, 500) + '...' : msg.content
      }));

      const requestBody = {
        model: 'gpt-3.5-turbo',  // Using 3.5-turbo for faster responses
        messages: optimizedMessages,
        max_tokens: 300,
        temperature: 0.7,
        stream: true  // Enable streaming for faster initial response
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      // Check if the response is ok
      if (!response.ok) {
        const errorData = await response.json();
        return new Response(JSON.stringify({
          error: 'OpenAI API error',
          details: errorData
        }), {
          status: response.status,
          headers: corsHeaders
        });
      }

      const data = await response.json();
      return new Response(JSON.stringify(data), { 
        headers: corsHeaders,
        status: 200
      });

    } catch (error) {
      // Handle any unexpected errors
      return new Response(JSON.stringify({
        error: 'Internal server error',
        message: error.message
      }), {
        status: 500,
        headers: corsHeaders
      });
    }
  }
};

