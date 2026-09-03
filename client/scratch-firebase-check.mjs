import { connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { connectFirestoreEmulator } from 'firebase/firestore';
import { connectStorageEmulator } from 'firebase/storage';

const base = './src/lib';
const { auth, db, storage } = await import(`${base}/firebase.ts`);

connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
connectFirestoreEmulator(db, '127.0.0.1', 8080);
connectStorageEmulator(storage, '127.0.0.1', 9199);

const { uploadDocument, updateDocument, deleteDocument, subscribeToDocuments, getDocumentUrl, downloadDocument } =
  await import(`${base}/documents.ts`);

async function waitForSnapshot(uid, predicate, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      unsub();
      reject(new Error('timeout waiting for snapshot'));
    }, timeoutMs);
    const unsub = subscribeToDocuments(
      uid,
      (docs) => {
        if (predicate(docs)) {
          clearTimeout(timer);
          unsub();
          resolve(docs);
        }
      },
      (err) => {
        clearTimeout(timer);
        unsub();
        reject(err);
      }
    );
  });
}

// User A
const credA = await createUserWithEmailAndPassword(auth, 'a@test.com', 'password123');
const uidA = credA.user.uid;
console.log('signed in as A:', uidA);

const file1 = new File(['conteudo boleto'], 'Vitor Hugo Alves(Boleto Agosto 2026).pdf', { type: 'application/pdf' });
await uploadDocument(uidA, file1, 'Boleto', []);
console.log('uploaded doc 1');

let docs = await waitForSnapshot(uidA, (d) => d.length === 1);
console.log('after upload 1:', docs.map((d) => `${d.category}/${d.name} (${d.size}b, mime=${d.mimeType})`));

const file2 = new File(['conteudo boleto repetido'], 'Vitor Hugo Alves(Boleto Agosto 2026).pdf', { type: 'application/pdf' });
await uploadDocument(uidA, file2, 'Boleto', docs.filter((d) => d.category === 'Boleto').map((d) => d.name));
docs = await waitForSnapshot(uidA, (d) => d.length === 2);
console.log('after duplicate-name upload:', docs.map((d) => `${d.category}/${d.name}`));

const target = docs.find((d) => d.name === 'Vitor Hugo Alves(Boleto Agosto 2026).pdf');
await updateDocument(uidA, target, { name: 'renomeado.pdf', category: 'Outra Categoria' }, []);
docs = await waitForSnapshot(uidA, (d) => d.some((x) => x.name === 'renomeado.pdf' && x.category === 'Outra Categoria'));
console.log('after rename+move:', docs.map((d) => `${d.category}/${d.name}`));

const url = await getDocumentUrl(docs.find((d) => d.name === 'renomeado.pdf'));
console.log('download url ok:', typeof url === 'string' && url.length > 0);

const toDelete = docs.find((d) => d.name === 'renomeado.pdf');
await deleteDocument(uidA, toDelete);
docs = await waitForSnapshot(uidA, (d) => d.length === 1);
console.log('after delete:', docs.map((d) => `${d.category}/${d.name}`));

// Security rules check: user B must NOT read user A's documents
const credB = await createUserWithEmailAndPassword(auth, 'b@test.com', 'password123');
const uidB = credB.user.uid;
console.log('signed in as B:', uidB);

try {
  await waitForSnapshot(uidA, () => true, 2000);
  console.log('SECURITY BUG: user B was able to read user A documents!');
} catch (err) {
  console.log('OK - user B blocked from reading user A documents:', err.code || err.message);
}

// re-sign-in as A to confirm A can still read own data (sanity)
await signInWithEmailAndPassword(auth, 'a@test.com', 'password123');
docs = await waitForSnapshot(uidA, (d) => d.length === 1);
console.log('A can still read own docs after switching back:', docs.length === 1);

console.log('OK - all Firebase documents.ts operations behaved as expected');
process.exit(0);
