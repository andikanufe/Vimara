import { readFileSync } from 'fs';
import { parse } from 'dotenv';

try {
  const envConfig = parse(readFileSync('.env'));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
  
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  console.log("Key starts with:", privateKey.substring(0, 30));
  console.log("Length:", privateKey.length);
  console.log("Contains real newlines?", privateKey.includes('\n'));
} catch(e) {
  console.error("Error:", e);
}
