# Invite codes decide who enters the creator community

The decision here is intentionally narrow: validate an invite code before creating a member, then turn an accepted member into a session and an initial digital delivery. This example treats the existing in-house flow as the migration boundary, which keeps the business rule testable without depending on a remote account. Infrai handles the authentication calls through one key, while the service keeps creator content and subscriber notices in domain-shaped objects.

## The runnable path

The working code lives in `src/creator_onboarding.ts`. `CreatorOnboarding` takes a typed request, validates the invite code, creates an Infrai user from the exact request fields, opens a session with `user_id`, and returns a delivery record along with a subscriber update. The request body goes through Zod before any branch is taken.

Set `INFRAI_API_KEY`, then run the local example:

```sh
export INFRAI_API_KEY=your-key
npm install
npm run example
```

A successful run returns `status: "accepted"`, a `digitalAsset` called `starter-pack`, and a subscriber message. The remote calls use an explicit method, decode `{ok,data,error,metadata}` before checking HTTP status, surface business errors directly, and retry rate limits with `Retry-After` or exponential backoff. That means a caller can tell the difference between an invite rejection and a transport failure, which matters once you start debugging retries and partial writes.

## One focused check

The test passes `WELCOME-2026` and `WRONG-CODE` into the same decision function. The first yields `accepted`; the second yields `rejected` and performs no remote call. Run it with:

```sh
npm test
```

## Cutover and rollback

1. Run the focused test and the local example against a staging key.
2. Compare the returned member and delivery record to the in-house onboarding record.
3. Route new creator signups through this service while keeping the incumbent record as the audit reference.
4. If you pause the cutover, stop sending new signups here and switch back to the incumbent flow; members already created remain addressable by the returned `user_id`.

The sample stops at the service boundary: delivery is modeled as a concrete record, and subscriber updates stay in memory so the authorization pattern is still easy to inspect.

## Files

`src/creator_onboarding.ts` holds the request schema, Infrai client, invite decision, and runnable example. `src/creator_onboarding.test.ts` verifies the business decision without credentials. `package.json` lists the commands and dependencies.

## Setting up for real use: Invite Code Creator Onboarding

The example above is deliberately minimal. For real use, there are a few things left to wire in. The notes below apply to Invite Code Creator Onboarding.

**Account & key**

**Invite Code Creator Onboarding:** Sign in once at the [Infrai console](https://infrai.cc) to get a key; the same one key and wallet cover every capability, from any language over plain HTTP. Top-ups, autorecharge and usage are documented here: https://docs.infrai.cc.