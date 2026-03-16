import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI('AIzaSyDhUBVbHy0h2J4RelM1WQoXq9PlsR5mWlQ');

async function testSDK() {
    try {
        console.log("Testing SDK gemini-1.5-flash...");
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent("Hello");
        console.log("Result:", result.response.text());
    } catch(e) {
        console.error("1.5 error:", e.message);
    }
    
    try {
        console.log("\nTesting SDK gemini-2.0-flash...");
        const model2 = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const result2 = await model2.generateContent("Hello");
        console.log("Result:", result2.response.text());
    } catch(e) {
        console.error("2.0 error:", e.message);
    }
}
testSDK();
