import { createStore, get, set } from 'idb-keyval';
import { addPoint, deletePoint } from './supabaseClient.js';

const queueStore = createStore('diff-belgique-tp', 'mutations');
const listeners = new Set();
let flushing = false;

function notify(event) {
  listeners.forEach((listener) => listener(event));
}

function generateId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function readQueue() {
  return (await get('queue', queueStore)) ?? [];
}

async function writeQueue(queue) {
  await set('queue', queue, queueStore);
}

export async function enqueue(mutation) {
  const entry = { id: generateId(), createdAt: Date.now(), ...mutation };
  const queue = await readQueue();
  queue.push(entry);
  await writeQueue(queue);
  notify({ type: 'queue-changed', length: queue.length });
  return entry;
}

export async function cancel(queueId) {
  const queue = await readQueue();
  const next = queue.filter((item) => item.id !== queueId);
  if (next.length !== queue.length) {
    await writeQueue(next);
    notify({ type: 'queue-changed', length: next.length });
  }
}

export async function getLength() {
  const queue = await readQueue();
  return queue.length;
}

async function processMutation(mutation) {
  if (mutation.type === 'insert') {
    await addPoint(mutation.payload);
  } else if (mutation.type === 'delete') {
    await deletePoint(mutation.payload.id);
  }
}

export async function flush() {
  if (flushing) return;
  flushing = true;
  notify({ type: 'sync-start' });

  try {
    let queue = await readQueue();
    while (queue.length > 0) {
      const [mutation, ...rest] = queue;
      await processMutation(mutation);
      queue = rest;
      await writeQueue(queue);
      notify({ type: 'queue-changed', length: queue.length });
    }
    notify({ type: 'sync-complete' });
  } catch (error) {
    notify({ type: 'sync-error', error });
  } finally {
    flushing = false;
  }
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    flush();
  });
}
