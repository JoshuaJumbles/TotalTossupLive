import { ChannelDurableObject, type Env } from './channelDurableObject';

export { ChannelDurableObject };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Single seeded channel for now — the id is already a real routing
    // parameter, not hardcoded elsewhere, so adding more channels later is
    // just minting more DO instances under different names. The full
    // request (including /channels/:id/...) is forwarded as-is so the DO
    // can parse its own channelId out of the path.
    const match = url.pathname.match(/^\/channels\/([^/]+)(\/.*)?$/);
    if (!match) {
      return new Response('not found', { status: 404 });
    }

    const [, channelId] = match;
    const id = env.CHANNEL.idFromName(channelId);
    const stub = env.CHANNEL.get(id);
    return stub.fetch(request);
  },
};
