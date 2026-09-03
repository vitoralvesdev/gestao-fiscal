import { connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { connectFirestoreEmulator } from 'firebase/firestore';
import { connectStorageEmulator } from 'firebase/storage';

const { auth, db, storage } = await import('./src/lib/firebase.ts');
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
connectFirestoreEmulator(db, '127.0.0.1', 8080);
connectStorageEmulator(storage, '127.0.0.1', 9199);

const { uploadDocument, subscribeToDocuments } = await import('./src/lib/documents.ts');

const credA = await createUserWithEmailAndPassword(auth, 'sec-a@test.com', 'password123');
const uidA = credA.user.uid;
const file1 = new File(['x'], 'arquivo.pdf', { type: 'application/pdf' });
await uploadDocument(uidA, file1, 'Boleto', []);
await new Promise((r) => setTimeout(r, 1500));

const credB = await createUserWithEmailAndPassword(auth, 'sec-b@test.com', 'password123');
console.log('now signed in as B, uid:', credB.user.uid, '- trying to read A uid:', uidA);

let settled = false;
const unsub = subscribeToDocuments(
  uidA,
  (docs) => {
    settled = true;
    console.log('onChange fired for B reading A data. doc count:', docs.length, JSON.stringify(docs));
    unsub();
  },
  (err) => {
    settled = true;
    console.log('onError fired (expected):', err.code, err.message);
    unsub();
  }
);

await new Promise((r) => setTimeout(r, 3000));
if (!settled) console.log('neither onChange nor onError fired within 3s (still pending)');
process.exit(0);
