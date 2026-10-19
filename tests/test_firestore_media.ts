import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import * as fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function testFirestoreMedia() {
  console.log('Testing Firestore connection to database:', config.firestoreDatabaseId);
  try {
    const testDoc = doc(db, 'test', 'connection');
    console.log('Doc ref created successfully');
  } catch (err: any) {
    console.error('Error:', err);
  }
}

testFirestoreMedia();
