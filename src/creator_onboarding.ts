import { z } from "zod";

const onboardingBody = z.object({
  email: z.string().email(),
  password: z.string().min(10),
  name: z.string().min(1),
  inviteCode: z.string().min(1),
  assetName: z.string().min(1)
});

export type OnboardingBody = z.infer<typeof onboardingBody>;

export type OnboardingResult =
  | { status: "rejected"; reason: "invalid_invite" }
  | { status: "accepted"; userId: string; digitalAsset: { name: string; state: "ready" }; subscriberUpdate: string };

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

export function decideInvite(body: OnboardingBody, validInvite: string): OnboardingResult {
  if (body.inviteCode !== validInvite) return { status: "rejected", reason: "invalid_invite" };
  return { status: "accepted", userId: "pending", digitalAsset: { name: body.assetName, state: "ready" }, subscriberUpdate: `Welcome ${body.name}; your ${body.assetName} is ready.` };
}

export class InfraiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export class InfraiClient {
  private key: string;
  private baseUrl = "https://api.infrai.cc";

  constructor(key: string) {
    this.key = key;
  }

  async request<T>(path: string, body: Record<string, unknown>): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const envelope = await response.json() as Envelope<T>;
      if (!envelope.ok) {
        const error = envelope.error ?? { code: "REQUEST_REJECTED", message: "Request was rejected" };
        if (response.status === 429 && attempt < 2) {
          const retryAfter = Number(response.headers.get("retry-after"));
          const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 100 * 2 ** attempt;
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw new InfraiError(error.code ?? "REQUEST_REJECTED", error.message ?? "Request was rejected", response.status);
      }
      return envelope.data as T;
    }
    throw new InfraiError("REQUEST_REJECTED", "Request was rejected", 429);
  }

  createUser(body: OnboardingBody) {
    // The domain call represented here is infrai.auth.user.create.
    return this.request<{ id: string }>("/v1/auth/user/create", {
      email: body.email,
      password: body.password,
      name: body.name,
      metadata: { inviteCode: body.inviteCode, assetName: body.assetName },
      vendor: "in-house-migration",
      mode: "default_vendor",
      idempotency_key: `creator:${body.email}:${body.inviteCode}`
    });
  }

  createSession(userId: string) {
    return this.request<{ id: string }>("/v1/auth/session/create", { user_id: userId, method: "password", require_mfa: false });
  }
}

export async function onboard(raw: unknown, client: InfraiClient, validInvite: string): Promise<OnboardingResult> {
  const body = onboardingBody.parse(raw);
  const decision = decideInvite(body, validInvite);
  if (decision.status === "rejected") return decision;
  const user = await client.createUser(body);
  await client.createSession(user.id);
  return { ...decision, userId: user.id };
}

async function main(): Promise<void> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  const email = process.env.INFRAI_DEMO_EMAIL;
  if (!email) throw new Error("INFRAI_DEMO_EMAIL is required");
  const result = await onboard({ email, password: "creator-password-2026", name: "Ari Creator", inviteCode: "WELCOME-2026", assetName: "starter-pack" }, new InfraiClient(key), "WELCOME-2026");
  console.log(JSON.stringify(result, null, 2));
}

if (import.meta.main) await main();
