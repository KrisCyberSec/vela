# Community Backend (Firebase)

Reference for the community system's real-time backend. Currently **dormant** — community runs on `localStorage` during MVP. Flip `LIVE_COMMUNITY` to `true` when you have 50–100 users.

## Why it's dormant

With <50 users, a real-time backend adds complexity without value:
- No one has anyone to talk to in real time
- Moderation workload is trivial at this scale
- `localStorage` keeps the app zero-dependency for early testers

Firebase is pre-wired so flipping it on is a one-line change.

## Files

| File | Purpose |
|------|---------|
| `src/community.js` | All Firebase/moderation logic, exposed as `communityMod.*` |
| `src/App.jsx` (lines 6800–7375) | `CommunityScreen`, posts/replies UI, wired to call `communityMod.moderateContent()` before posting |

## How it's wired

### The flag

```js
// src/community.js
export const LIVE_COMMUNITY = false;
```

When `false`: posts/replies go to `localStorage` (keys `vela_community_posts`, `vela_community_replies`, `vela_community_votes`, `vela_community_bookmarks`, `vela_community_reactions`).

When `true`: posts/replies go to Firestore via `communityMod.createPost()` etc.

### Moderation (active regardless of flag)

```js
communityMod.moderateContent(text)
// → { ok: true }  OR  { ok: false, reason: "..." }
```

Blocks:
- Profanity / hate speech (via `BLOCKED_WORDS`)
- Dangerous health claims (via `HEALTH_DANGER_PHRASES` — e.g., "miracle cure", "will cure you")
- Length outside 3–500 chars

Both `submitPost()` and `submitReply()` in `App.jsx` call this before accepting input. Error is shown in the compose overlay in red.

## Firebase setup (for when you enable it)

### 1. Create Firebase project

1. [console.firebase.google.com](https://console.firebase.google.com) → Add project → "vela-health"
2. Enable **Firestore** (start in production mode)
3. Enable **Authentication** → **Anonymous** sign-in method

### 2. Paste config into `community.js`

Replace the placeholder `FIREBASE_CONFIG` object with the Web app config from Firebase Console → Project settings → Your apps → Web:

```js
const FIREBASE_CONFIG = {
  apiKey: "...",
  authDomain: "vela-health.firebaseapp.com",
  projectId: "vela-health",
  storageBucket: "vela-health.appspot.com",
  messagingSenderId: "...",
  appId: "..."
};
```

### 3. Apply Firestore security rules

Rules are included as comments at the bottom of `community.js`. Paste them into Firestore Console → Rules. Summary:

- Posts/replies: anyone signed in (anonymous OK) can create, read their own writes
- Votes/reactions: signed-in users can write their own
- Reports: signed-in users can flag posts
- Moderators: admin UID list has elevated permissions

### 4. Flip the switch

```js
export const LIVE_COMMUNITY = true;
```

Commit, build, deploy. Existing localStorage posts stay on-device (they're not migrated) — fresh posts go to Firestore.

## Data shape (Firestore)

### `posts` collection

```js
{
  id: "auto-id",
  topicId: "hot-flashes" | "brain-fog" | ...,
  text: "...",
  authorUid: "anonymous-user-uid",
  authorAlias: "Anonymous Sage",
  createdAt: Timestamp,
  upvotes: 0,
  downvotes: 0,
  replyCount: 0,
  reactions: { heart: 0, hug: 0, ... },
  reported: false,      // filter on reported = false
  parentId: null        // for replies, this is the parent post ID
}
```

### `userTopics` collection

Custom topics users create (if you enable user-generated topics):

```js
{
  id: "auto-id",
  name: "...",
  description: "...",
  emoji: "🌿",
  createdBy: "uid",
  createdAt: Timestamp,
  postCount: 0
}
```

## Exposed API (from `communityMod`)

```js
// Called from App.jsx whether LIVE_COMMUNITY is true or false:
moderateContent(text) → { ok, reason? }

// Called only when LIVE_COMMUNITY = true:
fetchPosts(topicId)
createPost(topicId, text, parentId?)
votePost(postId, direction)       // 'up' or 'down', toggles/switches
reactToPost(postId, reactionType) // 'heart' | 'hug' | ...
reportPost(postId)                // flags `reported = true`
fetchUserTopics()
createTopic({ name, description, emoji })
```

## Cost expectations

Firebase free tier (Spark plan) is more than enough for the first 1,000 users:
- 50k reads/day, 20k writes/day, 20k deletes/day
- 1 GiB storage
- Anonymous auth is free and unlimited

When you outgrow it, Blaze (pay-as-you-go) pricing is cheap: ~$0.06 per 100k reads.

## Operational checklist when flipping on

- [ ] Firebase project created, Firestore + Anonymous auth enabled
- [ ] `FIREBASE_CONFIG` populated in `src/community.js`
- [ ] Firestore security rules applied
- [ ] `LIVE_COMMUNITY = true` set
- [ ] Smoke test: create a post, reply, vote, report — verify each lands in Firestore
- [ ] Add yourself to the admin UID list in security rules for moderation
- [ ] Set up Firestore indexes if queries slow down (Console will prompt when needed)

## Related docs

- [architecture.md](architecture.md) — how `CommunityScreen` fits in
- [../operations/infrastructure.md](../operations/infrastructure.md) — all services we use
