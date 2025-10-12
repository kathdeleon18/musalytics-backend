const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8080'); // Connect to the WebSocket server

ws.on('open', () => {
    console.log('Backend connected to WebSocket Server');
    ws.send('Hello from Backend!');
});

ws.on('message', (data) => {
    console.log('Received from WebSocket Server:', data.toString());
});

ws.on('error', (error) => {
    console.error('WebSocket error:', error);
});

ws.on('close', () => {
    console.log('WebSocket connection closed');
});

module.exports = ws;
