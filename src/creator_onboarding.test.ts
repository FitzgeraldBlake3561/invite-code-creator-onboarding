import test from "node:test";
import assert from "node:assert/strict";
import { decideInvite } from "./creator_onboarding.ts";

const body = { email: "creator@example.com", password: "creator-password-2026", name: "Ari Creator", inviteCode: "WELCOME-2026", assetName: "starter-pack" };

test("invite code controls onboarding and prepares the first delivery", () => {
  const accepted = decideInvite(body, "WELCOME-2026");
  assert.equal(accepted.status, "accepted");
  if (accepted.status === "accepted") {
    assert.equal(accepted.digitalAsset.state, "ready");
    assert.match(accepted.subscriberUpdate, /starter-pack/);
  }
  assert.deepEqual(decideInvite({ ...body, inviteCode: "WRONG-CODE" }, "WELCOME-2026"), { status: "rejected", reason: "invalid_invite" });
});
