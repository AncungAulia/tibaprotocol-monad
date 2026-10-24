import { PGlite } from "@electric-sql/pglite"
import { readFileSync } from "node:fs"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

const db = new PGlite()
const payer = "0x1111111111111111111111111111111111111111"
const carrier = "0x2222222222222222222222222222222222222222"
const warehouse = "0x3333333333333333333333333333333333333333"
const place = "11111111-1111-4111-8111-111111111111"

beforeAll(async () => {
  await db.exec(
    "create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to anon, authenticated, service_role;",
  )
  // Test the exact SQL artifact delivered for Supabase SQL Editor.
  // gen_random_uuid() is built into PostgreSQL; PGlite needs no pgcrypto extension.
  const sql = readFileSync(new URL("../supabase/setup.sql", import.meta.url), "utf8").replace(
    "create extension if not exists pgcrypto;",
    "",
  )
  await db.exec(sql)
}, 30000)
afterAll(async () => {
  await db.close()
})
beforeEach(async () => {
  await db.exec(
    "reset role; truncate profiles,companies,places,invites,relations,trips,locations,reports,gas_topups,pool_events cascade;",
  )
  await db.query("insert into profiles(address,role) values($1,'payer'),($2,'carrier')", [
    payer,
    carrier,
  ])
  await db.query(
    "insert into places(id,payer_address,name,address,lat,lng,kind,receiver_email) values($1,$2,'Warehouse','Semarang',-7,110,'destination','receiver@example.com')",
    [place, payer],
  )
})

describe("PostgreSQL migrations and API RPCs", () => {
  it("backfills existing trips with independent channels without changing cargo", async () => {
    const previous = new PGlite()
    try {
      await previous.exec(
        "create table public.trips(shipment_id bigint primary key,cargo text); insert into public.trips values(1,'Rice'),(2,'Corn');",
      )
      await previous.exec(
        readFileSync(
          new URL("../supabase/migrations/0005_trip_pickup_broadcast.sql", import.meta.url),
          "utf8",
        ),
      )
      const { rows } = await previous.query<{
        cargo: string
        picked_up_at: string | null
        channel_key: string
      }>("select cargo,picked_up_at,channel_key from trips order by shipment_id")
      expect(rows.map((row) => row.cargo)).toEqual(["Rice", "Corn"])
      expect(
        rows.every((row) => row.picked_up_at === null && /^[0-9a-f]{32}$/.test(row.channel_key)),
      ).toBe(true)
      expect(rows[0]!.channel_key).not.toBe(rows[1]!.channel_key)
    } finally {
      await previous.close()
    }
  })
  it("generates independent opaque channels and defaults pickup time to null", async () => {
    await db.query(
      "insert into trips(shipment_id,payer_address,carrier_address,consignee_address,cargo) values(1,$1,$2,$3,'Rice'),(2,$1,$2,$3,'Rice')",
      [payer, carrier, warehouse],
    )
    const rows = (
      await db.query<{ picked_up_at: string | null; channel_key: string }>(
        "select picked_up_at,channel_key from trips order by shipment_id",
      )
    ).rows
    expect(rows[0]?.picked_up_at).toBeNull()
    expect(rows[0]?.channel_key).toMatch(/^[0-9a-f]{32}$/)
    expect(rows[1]?.channel_key).not.toBe(rows[0]?.channel_key)
    await expect(
      db.query("update trips set channel_key='short' where shipment_id=1"),
    ).rejects.toThrow(/trips_channel_key_format/)
    await expect(
      db.query("update trips set channel_key=$1 where shipment_id=2", [rows[0]!.channel_key]),
    ).rejects.toThrow(/trips_channel_key_unique/)
  })
  it("distinguishes real GPS from simulated samples and rejects unknown sources", async () => {
    await db.query(
      "insert into trips(shipment_id,payer_address,carrier_address,consignee_address,cargo) values(1,$1,$2,$3,'Rice')",
      [payer, carrier, warehouse],
    )
    await db.exec(
      "insert into locations(shipment_id,lat,lng) values(1,-7,110); insert into locations(shipment_id,lat,lng,source) values(1,-7,110,'simulated');",
    )
    expect(
      (await db.query<{ source: string }>("select source from locations order by id")).rows.map(
        (row) => row.source,
      ),
    ).toEqual(["gps", "simulated"])
    await expect(
      db.query("insert into locations(shipment_id,lat,lng,source) values(1,-7,110,'fake')"),
    ).rejects.toThrow(/locations_source_check/)
  })
  it("creates all ten tables with RLS and removes anonymous read policies", async () => {
    const result = await db.query<{ tablename: string; rowsecurity: boolean }>(
      "select tablename,rowsecurity from pg_tables where schemaname='public'",
    )
    expect(result.rows).toHaveLength(10)
    expect(result.rows.every((r) => r.rowsecurity)).toBe(true)
    const policies = await db.query("select * from pg_policies where schemaname='public'")
    expect(policies.rows).toHaveLength(0)
    await db.exec("set role anon")
    await expect(db.query("select * from trips")).rejects.toThrow(/permission denied/)
    await expect(db.query("select * from locations")).rejects.toThrow(/permission denied/)
    await expect(
      db.query("select public.save_profile($1,'investor',null,null,null,null)", [warehouse]),
    ).rejects.toThrow(/permission denied/)
  })

  it("locks a wallet role while allowing updates for the same role", async () => {
    await db.exec("set role service_role")
    await db.query("select public.save_profile($1,'carrier','Budi',null,null,'AB 1234 CD')", [
      carrier,
    ])
    await expect(
      db.query("select public.save_profile($1,'investor',null,null,null,null)", [carrier]),
    ).rejects.toThrow(/role_conflict/)
    const row = await db.query<{ name: string; role: string }>(
      "select name,role from profiles where address=$1",
      [carrier],
    )
    expect(row.rows[0]).toEqual({ name: "Budi", role: "carrier" })
  })

  it("accepts carrier invite once and makes retries idempotent", async () => {
    await db.query(
      "insert into invites(token,kind,payer_address,expires_at) values('carrier-token','carrier',$1,now()+interval '1 day')",
      [payer],
    )
    await db.exec("set role service_role")
    const accepted = await db.query<{ result: { alreadyAccepted: boolean } }>(
      "select public.accept_invite('carrier-token',$1) as result",
      [carrier],
    )
    expect(accepted.rows[0]?.result.alreadyAccepted).toBe(false)
    const retry = await db.query<{ result: { alreadyAccepted: boolean } }>(
      "select public.accept_invite('carrier-token',$1) as result",
      [carrier],
    )
    expect(retry.rows[0]?.result.alreadyAccepted).toBe(true)
    expect((await db.query("select * from relations")).rows).toHaveLength(1)
    await expect(
      db.query("select public.accept_invite('carrier-token',$1)", [warehouse]),
    ).rejects.toThrow(/invite_used/)
  })

  it("binds only the invited email and rolls back failures", async () => {
    await db.query(
      "insert into invites(token,kind,payer_address,place_id,expires_at) values('warehouse-token','warehouse',$1,$2,now()+interval '1 day')",
      [payer, place],
    )
    await db.exec("set role service_role")
    await expect(
      db.query("select public.accept_invite('warehouse-token',$1,'Dewi','wrong@example.com')", [
        warehouse,
      ]),
    ).rejects.toThrow(/receiver_email_mismatch/)
    expect((await db.query("select used_by from invites")).rows[0]).toEqual({ used_by: null })
    expect(
      (await db.query("select address from profiles where address=$1", [warehouse])).rows,
    ).toHaveLength(0)
    await db.query(
      "select public.accept_invite('warehouse-token',$1,'Dewi','receiver@example.com')",
      [warehouse],
    )
    expect((await db.query("select receiver_address from places")).rows[0]).toEqual({
      receiver_address: warehouse,
    })
    expect(
      (await db.query("select role from profiles where address=$1", [warehouse])).rows[0],
    ).toEqual({ role: "warehouse" })
  })

  it("rolls back a relation if the final invite claim fails", async () => {
    await db.query(
      "insert into invites(token,kind,payer_address,expires_at) values('fail-token','carrier',$1,now()+interval '1 day')",
      [payer],
    )
    await db.exec(
      "create function reject_claim() returns trigger language plpgsql as $$ begin raise exception 'forced_failure'; end $$; create trigger reject_claim before update on invites for each row execute function reject_claim();",
    )
    try {
      await expect(
        db.query("select public.accept_invite('fail-token',$1)", [carrier]),
      ).rejects.toThrow(/forced_failure/)
      expect((await db.query("select * from relations")).rows).toHaveLength(0)
      expect((await db.query("select used_by from invites")).rows[0]).toEqual({ used_by: null })
    } finally {
      await db.exec("drop trigger reject_claim on invites; drop function reject_claim()")
    }
  })

  it("rejects expired invites without changing the network", async () => {
    await db.query(
      "insert into invites(token,kind,payer_address,expires_at) values('expired-token','carrier',$1,now()-interval '1 day')",
      [payer],
    )
    await expect(
      db.query("select public.accept_invite('expired-token',$1)", [carrier]),
    ).rejects.toThrow(/invite_expired/)
    expect((await db.query("select * from relations")).rows).toHaveLength(0)
  })

  it("honors the receiver email on a newly issued invitation", async () => {
    await db.query(
      "insert into invites(token,kind,payer_address,place_id,receiver_email,expires_at) values('specific-email','warehouse',$1,$2,'new@example.com',now()+interval '1 day')",
      [payer, place],
    )
    await expect(
      db.query(
        "select public.accept_invite('specific-email',$1,'Receiver','receiver@example.com')",
        [warehouse],
      ),
    ).rejects.toThrow(/receiver_email_mismatch/)
    await db.query(
      "select public.accept_invite('specific-email',$1,'Receiver','new@example.com')",
      [warehouse],
    )
    expect((await db.query("select receiver_address from places")).rows[0]).toEqual({
      receiver_address: warehouse,
    })
  })

  it("validates coordinates and accepts the full on-chain uint32 report quantity", async () => {
    await expect(
      db.query(
        "insert into places(payer_address,name,address,lat,lng,kind) values($1,'Bad','Bad',91,110,'pickup')",
        [payer],
      ),
    ).rejects.toThrow(/places_coordinates/)
    await db.query(
      "insert into reports(shipment_id,issues,received_qty,reporter_address) values(1,array['damaged'],4294967295,$1)",
      [warehouse],
    )
    await expect(db.query("update reports set received_qty=4294967296")).rejects.toThrow(
      /reports_quantity_range/,
    )
    await expect(db.query("update reports set issues=array['Unknown']")).rejects.toThrow(
      /reports_issues_allowed/,
    )
  })
})
