import { initializeApp } from 'firebase/app';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
console.log('Project ID:', config.projectId);
console.log('Storage Bucket:', config.storageBucket);

const app = initializeApp(config);
const storage = getStorage(app);

async function testUpload() {
  try {
    const testRef = ref(storage, 'test_ping.txt');
    const bytes = new TextEncoder().encode('ping');
    await uploadBytes(testRef, bytes);
    const url = await getDownloadURL(testRef);
    console.log('Upload success! URL:', url);
  } catch (err: any) {
    console.error('Upload failed with error code:', err?.code, err?.message);
  }
}

testUpload();
