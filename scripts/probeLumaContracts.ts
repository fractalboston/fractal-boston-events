/**
 * Live probe for Luma public API pagination + external-event contracts.
 *
 * Usage: pnpm tsx scripts/probeLumaContracts.ts
 */
import { config } from "dotenv";

config({ path: ".env.local" });

type Entry = {
  id?: string;
  platform?: string;
  access?: string;
  visibility?: string;
  name?: string;
  url?: string;
  start_at?: string;
  cover_url?: string;
  host?: string | null;
};

type ListResponse = {
  entries: Entry[];
  has_more: boolean;
  next_cursor?: string;
};

async function list(
  params: URLSearchParams,
  label: string
): Promise<ListResponse | null> {
  const key = process.env.LUMA_API_KEY;
  if (key === undefined || key === "") {
    throw new Error("LUMA_API_KEY missing");
  }

  const response = await fetch(
    `https://public-api.luma.com/v1/calendars/events/list?${params}`,
    {
      headers: {
        accept: "application/json",
        "x-luma-api-key": key,
      },
    }
  );
  const text = await response.text();
  console.log(`\n=== ${label} status=${String(response.status)} ===`);
  if (!response.ok) {
    console.log(text.slice(0, 800));
    return null;
  }

  const data = JSON.parse(text) as ListResponse;
  console.log(
    JSON.stringify(
      {
        has_more: data.has_more,
        next_cursor: data.next_cursor ?? null,
        entryCount: data.entries.length,
        entries: data.entries.map((entry) => ({
          id: entry.id,
          platform: entry.platform,
          access: entry.access,
          visibility: entry.visibility ?? "<missing>",
          name: entry.name,
          url: entry.url,
          start_at: entry.start_at,
          cover_url:
            entry.cover_url === undefined
              ? "<missing>"
              : entry.cover_url === ""
                ? "empty-string"
                : "present",
          host: Object.prototype.hasOwnProperty.call(entry, "host")
            ? entry.host
            : "<missing>",
          keys: Object.keys(entry).sort(),
        })),
      },
      null,
      2
    )
  );

  const external = data.entries.find((entry) => entry.platform === "external");
  if (external !== undefined) {
    console.log("RAW_EXTERNAL_SAMPLE", JSON.stringify(external, null, 2));
  }

  return data;
}

async function main(): Promise<void> {
  const now = new Date();
  const in60 = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  const after = now.toISOString();
  const before = in60.toISOString();

  function base(limit: string): URLSearchParams {
    const params = new URLSearchParams({
      after,
      before,
      pagination_limit: limit,
      sort_column: "start_at",
      sort_direction: "asc",
    });
    params.append("access", "manage");
    params.append("access", "view");
    return params;
  }

  const both = base("1");
  both.append("platforms", "luma");
  both.append("platforms", "external");

  const page1 = await list(both, "page1 limit=1 both platforms");
  if (page1 === null) {
    process.exitCode = 1;
    return;
  }

  if (page1.has_more && page1.next_cursor !== undefined) {
    const page2params = new URLSearchParams(both);
    page2params.set("pagination_cursor", page1.next_cursor);
    const page2 = await list(page2params, "page2 via next_cursor");
    if (page2 === null) {
      process.exitCode = 1;
      return;
    }

    const id1 = page1.entries[0]?.id;
    const id2 = page2.entries[0]?.id;
    console.log(
      "\nPAGINATION_IDS_DISTINCT",
      id1 !== undefined && id2 !== undefined && id1 !== id2,
      id1,
      id2
    );

    let cursor: string | null =
      page2.has_more && page2.next_cursor !== undefined
        ? page2.next_cursor
        : null;
    let pages = 2;
    const ids = new Set<string>();
    for (const entry of [...page1.entries, ...page2.entries]) {
      if (entry.id !== undefined) {
        ids.add(entry.id);
      }
    }

    while (cursor !== null) {
      const params = new URLSearchParams(both);
      params.set("pagination_cursor", cursor);
      const page = await list(params, `page${String(pages + 1)}`);
      pages += 1;
      if (page === null) {
        process.exitCode = 1;
        return;
      }
      for (const entry of page.entries) {
        if (entry.id !== undefined) {
          ids.add(entry.id);
        }
      }
      cursor =
        page.has_more && page.next_cursor !== undefined
          ? page.next_cursor
          : null;
      if (pages > 20) {
        break;
      }
    }

    console.log("\nPAGINATION_WALK", { pages, uniqueIds: ids.size });
  } else {
    console.log(
      "\nPAGINATION_SKIPPED (not enough events in 60d window for multi-page)"
    );
  }

  const externalOnly = base("50");
  externalOnly.append("platforms", "external");
  await list(externalOnly, "external only 60d");

  const lumaOnly = base("50");
  lumaOnly.append("platforms", "luma");
  await list(lumaOnly, "luma only 60d");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
