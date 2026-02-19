/**
 * Data Migration Script
 *
 * This script migrates data from local JSON files to Firebase Firestore.
 *
 * Usage:
 *   1. Set up Firebase credentials in .env file
 *   2. Run: npx ts-node scripts/migrate-data.ts <clubCode> <dataDir>
 *
 * Example:
 *   npx ts-node scripts/migrate-data.ts HMMC ../
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, collection, Timestamp } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

// Firebase config - replace with your actual config
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

interface Player {
  name: string;
  gender: '남' | '여';
  hand: '오른손' | '왼손';
  age_group: string;
  racket: string;
  group: string;
  ntrp: number | null;
  mbti: string | null;
}

interface SessionData {
  schedule: [string, string[], string[], number][];
  results: Record<string, {
    t1: number | null;
    t2: number | null;
    sides?: Record<string, string>;
  }>;
  groupsSnapshot?: Record<string, string>;
}

async function migrateClub(clubCode: string, adminEmail: string) {
  console.log(`Creating club: ${clubCode}`);

  const clubRef = doc(db, 'clubs', clubCode);
  await setDoc(clubRef, {
    name: clubCode,
    adminEmails: [adminEmail],
    createdAt: Timestamp.now(),
    settings: {
      defaultDoublesMode: '랜덤복식',
      courtCount: 2,
    },
  });

  console.log(`Club ${clubCode} created`);
}

async function migratePlayers(clubCode: string, dataDir: string) {
  const filePath = path.join(dataDir, `${clubCode}_players.json`);

  if (!fs.existsSync(filePath)) {
    console.log(`Players file not found: ${filePath}`);
    return 0;
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Player[];
  console.log(`Found ${data.length} players to migrate`);

  let count = 0;
  for (const player of data) {
    const playerRef = doc(collection(db, 'clubs', clubCode, 'players'));

    await setDoc(playerRef, {
      name: player.name,
      gender: player.gender,
      hand: player.hand,
      ageGroup: player.age_group,
      racket: player.racket,
      group: player.group || '미배정',
      ntrp: player.ntrp,
      mbti: player.mbti === '모름' ? null : player.mbti,
      createdAt: Timestamp.now(),
    });

    count++;
    if (count % 10 === 0) {
      console.log(`  Migrated ${count} players...`);
    }
  }

  console.log(`Migrated ${count} players`);
  return count;
}

async function migrateSessions(clubCode: string, dataDir: string) {
  const filePath = path.join(dataDir, `${clubCode}_sessions.json`);

  if (!fs.existsSync(filePath)) {
    console.log(`Sessions file not found: ${filePath}`);
    return 0;
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, SessionData>;
  const dates = Object.keys(data);
  console.log(`Found ${dates.length} sessions to migrate`);

  let count = 0;
  for (const date of dates) {
    const session = data[date];
    const sessionRef = doc(db, 'clubs', clubCode, 'sessions', date);

    await setDoc(sessionRef, {
      schedule: session.schedule || [],
      results: session.results || {},
      groupsSnapshot: session.groupsSnapshot,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    count++;
    if (count % 10 === 0) {
      console.log(`  Migrated ${count} sessions...`);
    }
  }

  console.log(`Migrated ${count} sessions`);
  return count;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log('Usage: npx ts-node scripts/migrate-data.ts <clubCode> <dataDir>');
    console.log('Example: npx ts-node scripts/migrate-data.ts HMMC ../');
    process.exit(1);
  }

  const [clubCode, dataDir] = args;
  const adminEmail = args[2] || 'admin@example.com';

  console.log('='.repeat(50));
  console.log(`Migration for club: ${clubCode}`);
  console.log(`Data directory: ${dataDir}`);
  console.log('='.repeat(50));

  try {
    // Create club document
    await migrateClub(clubCode, adminEmail);

    // Migrate players
    const playerCount = await migratePlayers(clubCode, dataDir);

    // Migrate sessions
    const sessionCount = await migrateSessions(clubCode, dataDir);

    console.log('='.repeat(50));
    console.log('Migration complete!');
    console.log(`  Players: ${playerCount}`);
    console.log(`  Sessions: ${sessionCount}`);
    console.log('='.repeat(50));

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

main();
