import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  normalizeInstagramUsername,
  normalizeProfilePictureUrl,
  type InstagramProfileInput,
} from "./core";

type InstagramEnv = CloudflareEnv & {
  INSTAGRAM_ACCESS_TOKEN?: string;
  INSTAGRAM_BUSINESS_ACCOUNT_ID?: string;
  INSTAGRAM_GRAPH_API_VERSION?: string;
};

type MetaBusinessDiscoveryResponse = {
  business_discovery?: {
    username?: unknown;
    biography?: unknown;
    profile_picture_url?: unknown;
  };
};

export interface InstagramProfileProvider {
  getProfile(username: string): Promise<InstagramProfileInput>;
}

class MetaBusinessDiscoveryProvider implements InstagramProfileProvider {
  constructor(
    private readonly accountId: string,
    private readonly accessToken: string,
    private readonly apiVersion: string,
  ) {}

  async getProfile(username: string): Promise<InstagramProfileInput> {
    const normalized = normalizeInstagramUsername(username);
    if (!normalized) throw new Error("Invalid Instagram username.");

    const fields = `business_discovery.username(${normalized}){username,biography,profile_picture_url}`;
    const url = new URL(
      `https://graph.facebook.com/${this.apiVersion}/${this.accountId}`,
    );
    url.searchParams.set("fields", fields);

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${this.accessToken}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error(
        "Instagram could not return this profile. It may be personal, private, or unavailable to Business Discovery.",
      );
    }

    const payload = (await response.json()) as MetaBusinessDiscoveryResponse;
    const profile = payload.business_discovery;
    const returnedUsername = normalizeInstagramUsername(profile?.username);
    if (!returnedUsername) {
      throw new Error("Instagram returned an incomplete profile.");
    }
    const photo = normalizeProfilePictureUrl(profile?.profile_picture_url);

    return {
      username: returnedUsername,
      biography: typeof profile?.biography === "string"
        ? profile.biography.trim().slice(0, 2_200) || null
        : null,
      profilePictureUrl: typeof photo === "string" ? photo : null,
    };
  }
}

async function getInstagramEnv() {
  const { env } = await getCloudflareContext({ async: true });
  return env as InstagramEnv;
}

export async function isInstagramImportConfigured() {
  const env = await getInstagramEnv();
  return Boolean(
    env.INSTAGRAM_ACCESS_TOKEN &&
      env.INSTAGRAM_BUSINESS_ACCOUNT_ID &&
      env.INSTAGRAM_GRAPH_API_VERSION?.match(/^v\d+\.\d+$/u),
  );
}

export async function getInstagramProvider() {
  const env = await getInstagramEnv();
  if (
    !env.INSTAGRAM_ACCESS_TOKEN ||
    !env.INSTAGRAM_BUSINESS_ACCOUNT_ID ||
    !env.INSTAGRAM_GRAPH_API_VERSION?.match(/^v\d+\.\d+$/u)
  ) {
    return null;
  }
  return new MetaBusinessDiscoveryProvider(
    env.INSTAGRAM_BUSINESS_ACCOUNT_ID,
    env.INSTAGRAM_ACCESS_TOKEN,
    env.INSTAGRAM_GRAPH_API_VERSION,
  );
}
