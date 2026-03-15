
import axios from 'axios';

const API_URL = 'http://localhost:3000/api/chatbot/message';

async function testChatbot() {
  const conversationId = `test-conv-${Date.now()}`;
  const message = 'What is the date today?';

  console.log(`Testing with conversationId: ${conversationId}`);
  console.log(`User message: ${message}`);

  try {
    const response = await axios.post(API_URL, {
      conversationId,
      message,
    });

    console.log('Agent response:', response.data);
  } catch (error) {
    if (axios.isAxiosError(error)) {
        console.error('Error testing chatbot:', error.response?.data || error.message);
    } else {
        console.error('An unexpected error occurred:', error);
    }
  }
}

testChatbot();
