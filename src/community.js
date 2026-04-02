// ─── Vela Community Backend ─────────────────────────────────────────────────
// Firebase Firestore backend for live community features.
// Toggle LIVE_COMMUNITY to switch between simulated (localStorage) and live mode.
//
// To activate:
// 1. Create a Firebase project at console.firebase.google.com
// 2. Enable Firestore Database (start in test mode, then add security rules)
// 3. Enable Anonymous Authentication
// 4. Copy your config into FIREBASE_CONFIG below
// 5. Set LIVE_COMMUNITY = true
// ────────────────────────────────────────────────────────────────────────────

export const LIVE_COMMUNITY = false;

const FIREBASE_CONFIG = {
  // Replace with your Firebase project config
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
};

// ─── Firebase Initialization (lazy) ─────────────────────────────────────────

let _app = null;
let _db = null;
let _auth = null;
let _userId = null;

async function getFirebase() {
  if (_app) return { app: _app, db: _db, auth: _auth };
  const { initializeApp } = await import("firebase/app");
  const { getFirestore } = await import("firebase/firestore");
  const { getAuth, signInAnonymously } = await import("firebase/auth");

  _app = initializeApp(FIREBASE_CONFIG);
  _db = getFirestore(_app);
  _auth = getAuth(_app);

  // Anonymous sign-in — no account needed, privacy-first
  try {
    const cred = await signInAnonymously(_auth);
    _userId = cred.user.uid;
  } catch (e) {
    console.warn("Vela community: anonymous auth failed", e);
    _userId = "anon-" + Math.random().toString(36).slice(2, 10);
  }

  return { app: _app, db: _db, auth: _auth };
}

function getUserId() {
  return _userId || "anon-" + Math.random().toString(36).slice(2, 10);
}

// ─── Firestore Collections ──────────────────────────────────────────────────
// community_posts: { id, topicId, text, authorId, time, parentId?, reported? }
// community_votes: { postId_userId: { vote: "up"|"down" } }
// community_reactions: { postId_userId: { types: ["hug","strength","thanks"] } }

// ─── Content Moderation ─────────────────────────────────────────────────────

const BLOCKED_WORDS = [
  // Slurs and hate speech (abbreviated list — expand before launch)
  "fuck", "shit", "bitch", "ass", "dick", "cunt", "retard",
  "kill yourself", "kys", "suicide method",
  // Spam patterns
  "buy now", "click here", "free money", "dm me",
];

const HEALTH_DANGER_PHRASES = [
  "stop taking your medication", "don't take your meds",
  "cure for menopause", "guaranteed cure", "miracle cure",
  "doctors are lying", "medicine is poison",
];

export function moderateContent(text) {
  const lower = text.toLowerCase();

  // Check blocked words
  for (const word of BLOCKED_WORDS) {
    if (lower.includes(word)) {
      return { allowed: false, reason: "inappropriate language" };
    }
  }

  // Check dangerous health claims
  for (const phrase of HEALTH_DANGER_PHRASES) {
    if (lower.includes(phrase)) {
      return { allowed: false, reason: "potentially harmful health advice" };
    }
  }

  // Length check
  if (text.trim().length < 3) {
    return { allowed: false, reason: "too short" };
  }
  if (text.length > 500) {
    return { allowed: false, reason: "too long (500 character limit)" };
  }

  return { allowed: true };
}

// ─── Post Operations ────────────────────────────────────────────────────────

export async function fetchPosts(topicId) {
  if (!LIVE_COMMUNITY) return null; // Fall back to localStorage/simulated
  const { db } = await getFirebase();
  const { collection, query, where, orderBy, limit, getDocs } = await import("firebase/firestore");

  const q = query(
    collection(db, "community_posts"),
    where("topicId", "==", topicId),
    where("reported", "==", false),
    orderBy("time", "desc"),
    limit(50)
  );
  const snap = await getDocs(q);
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export async function createPost(topicId, text, parentId = null) {
  if (!LIVE_COMMUNITY) return null;

  const modResult = moderateContent(text);
  if (!modResult.allowed) {
    return { error: modResult.reason };
  }

  const { db } = await getFirebase();
  const { collection, addDoc, serverTimestamp } = await import("firebase/firestore");

  const post = {
    topicId,
    text: text.trim(),
    authorId: getUserId(),
    time: serverTimestamp(),
    parentId: parentId || null,
    reported: false,
    upvotes: 0,
  };

  const ref = await addDoc(collection(db, "community_posts"), post);
  return { id: ref.id, ...post, time: new Date().toISOString(), author: "Anonymous" };
}

export async function votePost(postId, direction) {
  if (!LIVE_COMMUNITY) return null;
  const { db } = await getFirebase();
  const { doc, setDoc, deleteDoc, getDoc, updateDoc, increment } = await import("firebase/firestore");

  const voteId = `${postId}_${getUserId()}`;
  const voteRef = doc(db, "community_votes", voteId);
  const postRef = doc(db, "community_posts", postId);

  const existing = await getDoc(voteRef);
  if (existing.exists()) {
    const prev = existing.data().vote;
    if (prev === direction) {
      // Undo vote
      await deleteDoc(voteRef);
      await updateDoc(postRef, { upvotes: increment(direction === "up" ? -1 : 1) });
      return null;
    } else {
      // Switch vote
      await setDoc(voteRef, { vote: direction });
      await updateDoc(postRef, { upvotes: increment(direction === "up" ? 2 : -2) });
      return direction;
    }
  } else {
    // New vote
    await setDoc(voteRef, { vote: direction });
    await updateDoc(postRef, { upvotes: increment(direction === "up" ? 1 : -1) });
    return direction;
  }
}

export async function reactToPost(postId, reactionType) {
  if (!LIVE_COMMUNITY) return null;
  const { db } = await getFirebase();
  const { doc, getDoc, setDoc } = await import("firebase/firestore");

  const reactionId = `${postId}_${getUserId()}`;
  const ref = doc(db, "community_reactions", reactionId);

  const existing = await getDoc(ref);
  let types = existing.exists() ? existing.data().types || [] : [];

  if (types.includes(reactionType)) {
    types = types.filter((t) => t !== reactionType);
  } else {
    types = [...types, reactionType];
  }

  await setDoc(ref, { types });
  return types;
}

export async function reportPost(postId) {
  if (!LIVE_COMMUNITY) return null;
  const { db } = await getFirebase();
  const { doc, updateDoc } = await import("firebase/firestore");

  await updateDoc(doc(db, "community_posts", postId), { reported: true });
  return true;
}

// ─── Topic Operations ───────────────────────────────────────────────────────

export async function fetchUserTopics() {
  if (!LIVE_COMMUNITY) return null;
  const { db } = await getFirebase();
  const { collection, query, orderBy, limit, getDocs } = await import("firebase/firestore");

  const q = query(
    collection(db, "community_topics"),
    orderBy("createdAt", "desc"),
    limit(20)
  );
  const snap = await getDocs(q);
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data(), posts: [] }));
}

export async function createTopic(topicData) {
  if (!LIVE_COMMUNITY) return null;

  const modResult = moderateContent(topicData.title);
  if (!modResult.allowed) return { error: modResult.reason };

  const { db } = await getFirebase();
  const { collection, addDoc, serverTimestamp } = await import("firebase/firestore");

  const topic = {
    icon: topicData.icon || "💬",
    title: topicData.title.trim(),
    description: (topicData.description || "").trim(),
    tags: topicData.tags || [],
    authorId: getUserId(),
    createdAt: serverTimestamp(),
    resources: [],
  };

  const ref = await addDoc(collection(db, "community_topics"), topic);
  return { id: ref.id, ...topic, createdAt: new Date().toISOString(), posts: [] };
}

// ─── Firestore Security Rules (deploy these to Firebase) ────────────────────
// Save as firestore.rules in your Firebase project:
//
// rules_version = '2';
// service cloud.firestore {
//   match /databases/{database}/documents {
//     // Posts: anyone can read non-reported, authenticated can write
//     match /community_posts/{postId} {
//       allow read: if resource.data.reported == false;
//       allow create: if request.auth != null
//         && request.resource.data.text.size() <= 500
//         && request.resource.data.text.size() >= 3
//         && request.resource.data.reported == false;
//       allow update: if request.auth != null
//         && (request.resource.data.diff(resource.data).affectedKeys()
//             .hasOnly(['upvotes', 'reported']));
//     }
//     // Votes: user can only manage their own
//     match /community_votes/{voteId} {
//       allow read, write: if request.auth != null
//         && voteId.matches('^.*_' + request.auth.uid + '$');
//     }
//     // Reactions: user can only manage their own
//     match /community_reactions/{reactionId} {
//       allow read, write: if request.auth != null
//         && reactionId.matches('^.*_' + request.auth.uid + '$');
//     }
//     // Topics: anyone can read, authenticated can create
//     match /community_topics/{topicId} {
//       allow read: if true;
//       allow create: if request.auth != null
//         && request.resource.data.title.size() <= 60;
//     }
//   }
// }
