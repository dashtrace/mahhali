import { Prisma, type OrderStatus } from "@prisma/client";
import { auth } from "@/server/auth/auth";
import { prisma } from "@/server/db";
import { reviewAuthorName } from "@/server/domain/names";
import { PALETTES } from "@/server/domain/theme";
import { hashToken, randomToken } from "@/server/domain/tokens";

// Demo data for local runs and the pitch: a Beirut clothing shop with stock,
// couriers, orders in every status, remittances with gaps and reviews, plus a
// small Arabic shop in pounds. Run on an empty database (`npx prisma migrate reset`).

const PASSWORD = "demo-pass-2026";
const SLUG = "beirut-threads";
const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const ago = (days: number, hours = 0) => new Date(now - days * DAY - hours * 60 * 60 * 1000);

async function user(name: string, email: string, admin = false) {
  const { user } = await auth.api.signUpEmail({ body: { name, email, password: PASSWORD } });
  if (admin) await prisma.user.update({ where: { id: user.id }, data: { role: "admin" } });
  return user.id;
}

function member(shopId: string, userId: string, role: string, courierId?: string) {
  return prisma.membership.create({ data: { id: crypto.randomUUID(), shopId, userId, role, courierId } });
}

type Option = { size?: string; colour?: string; price: number; stock: number };

async function product(shopId: string, name: string, description: string, options: Option[]) {
  return prisma.product.create({
    data: {
      shopId,
      name,
      description,
      variants: {
        create: options.map((o) => ({
          shopId,
          size: o.size ?? null,
          colour: o.colour ?? null,
          priceMinor: BigInt(o.price),
          available: o.stock,
          stockMovements: { create: { shopId, delta: o.stock, reason: "ADJUST" as const, note: "Opening stock" } },
        })),
      },
    },
    include: { variants: true },
  });
}

type Variant = Awaited<ReturnType<typeof product>>["variants"][number] & { productName: string };

type Customer = { name: string; phone: string; email?: string; governorate: string; district: string; area: string; addressLine: string; landmark?: string };

const PATH: OrderStatus[] = ["NEW", "CONFIRMED", "PACKED", "OUT_FOR_DELIVERY"];

type OrderSpec = {
  customer: Customer;
  lines: { variant: Variant; qty: number }[];
  status: OrderStatus;
  daysAgo: number;
  courierId?: string;
  courierName?: string;
  source?: "CATALOGUE" | "MANUAL";
  /** Cash reported at the door; defaults to exactly what was due. */
  reportedUsdCents?: bigint;
  reportedLbp?: bigint;
  failureReason?: string;
  deliveredBy?: string;
};

/** An order walked through its history: events, stock movements and counters as the real flow writes them. */
async function order(
  shop: { id: string; currency: "USD" | "LBP"; usdLbpRate: Prisma.Decimal | null; deliveryFeeMinor: bigint },
  actorUserId: string,
  o: OrderSpec,
) {
  return prisma.$transaction(async (tx) => {
    const { nextOrderSeq } = await tx.shop.update({ where: { id: shop.id }, data: { nextOrderSeq: { increment: 1 } } });
    const customer = await tx.customer.upsert({
      where: { shopId_phone: { shopId: shop.id, phone: o.customer.phone } },
      create: { shopId: shop.id, name: o.customer.name, phone: o.customer.phone, email: o.customer.email },
      update: {},
    });
    const subtotal = o.lines.reduce((sum, l) => sum + l.variant.priceMinor * BigInt(l.qty), 0n);
    const total = subtotal + shop.deliveryFeeMinor;
    const placed = ago(o.daysAgo, 6);

    // The steps this order went through, an hour or so apart.
    const steps: OrderStatus[] =
      o.status === "CANCELLED" ? ["NEW", "CANCELLED"]
      : o.status === "DELIVERED" || o.status === "RETURNED" ? [...PATH, o.status]
      : PATH.slice(0, PATH.indexOf(o.status) + 1);
    const at = (i: number) => new Date(placed.getTime() + i * 75 * 60 * 1000);
    const confirmed = steps.includes("CONFIRMED") ? at(1) : null;
    const delivered = o.status === "DELIVERED" ? at(steps.length - 1) : null;

    const created = await tx.order.create({
      data: {
        shopId: shop.id,
        number: nextOrderSeq - 1,
        publicToken: randomToken(),
        status: o.status,
        source: o.source ?? "CATALOGUE",
        createdByUserId: o.source === "MANUAL" ? actorUserId : null,
        customerId: customer.id,
        customerName: o.customer.name,
        customerPhone: o.customer.phone,
        customerEmail: o.customer.email ?? null,
        governorate: o.customer.governorate,
        district: o.customer.district,
        area: o.customer.area,
        addressLine: o.customer.addressLine,
        landmark: o.customer.landmark ?? null,
        courierId: o.courierId ?? null,
        currency: shop.currency,
        usdLbpRate: shop.usdLbpRate,
        subtotalMinor: subtotal,
        deliveryFeeMinor: shop.deliveryFeeMinor,
        totalMinor: total,
        codMinor: total,
        reportedUsdCents: delivered ? (o.reportedUsdCents ?? (shop.currency === "USD" && !o.reportedLbp ? total : null)) : null,
        reportedLbp: delivered ? (o.reportedLbp ?? (shop.currency === "LBP" ? total : null)) : null,
        failureReason: o.failureReason ?? null,
        deliveredByUserId: delivered ? (o.deliveredBy ?? actorUserId) : null,
        firstContactAt: o.source === "MANUAL" ? new Date(placed.getTime() - 40 * 60 * 1000) : placed,
        confirmedAt: confirmed,
        deliveredAt: delivered,
        createdAt: placed,
        items: {
          create: o.lines.map((l) => ({
            shopId: shop.id,
            variantId: l.variant.id,
            nameSnapshot: [l.variant.productName, l.variant.size, l.variant.colour].filter(Boolean).join(" / "),
            unitPriceMinor: l.variant.priceMinor,
            qty: l.qty,
          })),
        },
      },
    });

    const events: Prisma.OrderEventCreateManyInput[] = [];
    const movements: Prisma.StockMovementCreateManyInput[] = [];
    steps.forEach((status, i) => {
      events.push({
        shopId: shop.id,
        orderId: created.id,
        type: "STATUS",
        fromValue: i === 0 ? null : steps[i - 1],
        toValue: status,
        note: status === "RETURNED" ? o.failureReason : status === "CANCELLED" ? "Customer changed their mind" : null,
        actorUserId: i === 0 && o.source !== "MANUAL" ? null : actorUserId,
        at: at(i),
      });
      if (status === "CONFIRMED" && o.courierId) {
        events.push({ shopId: shop.id, orderId: created.id, type: "COURIER", toValue: o.courierName!, actorUserId, at: at(i) });
      }
    });

    for (const l of o.lines) {
      const reserve = { shopId: shop.id, variantId: l.variant.id, orderId: created.id, actorUserId: null };
      movements.push({ ...reserve, delta: -l.qty, reason: "RESERVE", at: at(0) });
      let available = -l.qty;
      let reserved = l.qty;
      if (steps.includes("OUT_FOR_DELIVERY")) {
        movements.push({ ...reserve, delta: -l.qty, reason: "SHIP", at: at(3) });
        reserved -= l.qty;
      }
      if (o.status === "CANCELLED") {
        movements.push({ ...reserve, delta: l.qty, reason: "RELEASE", at: at(1) });
        available += l.qty;
        reserved -= l.qty;
      }
      if (o.status === "RETURNED") {
        movements.push({ ...reserve, delta: l.qty, reason: "RESTOCK", at: at(4) });
        available += l.qty;
      }
      await tx.variant.update({
        where: { id: l.variant.id },
        data: { available: { increment: available }, reserved: { increment: reserved } },
      });
    }
    await tx.orderEvent.createMany({ data: events });
    await tx.stockMovement.createMany({ data: movements });
    return created;
  });
}

async function main() {
  if (await prisma.shop.findUnique({ where: { slug: SLUG } })) {
    console.log(`Already seeded ("${SLUG}" exists). For a fresh copy: "npx prisma migrate reset", then "npm run db:seed".`);
    return;
  }

  // People
  const ownerId = await user("Rania Khoury", "owner@demo.shoplink.lb");
  const managerId = await user("Karim Saade", "manager@demo.shoplink.lb");
  const staffId = await user("Lea Haddad", "staff@demo.shoplink.lb");
  const riderId = await user("Ali Hamdan", "rider@demo.shoplink.lb");
  await user("Platform Admin", "admin@demo.shoplink.lb", true);
  const zaatarOwnerId = await user("Samir Nassar", "zaatar@demo.shoplink.lb");

  // Main shop: USD, English catalogue
  const shop = await prisma.shop.create({
    data: {
      id: crypto.randomUUID(),
      name: "Beirut Threads",
      slug: SLUG,
      currency: "USD",
      usdLbpRate: new Prisma.Decimal("89500"),
      deliveryFeeMinor: 400n,
      codToleranceMinor: 50n,
      autoCancelHours: 48,
      whatsappPhone: "+96170123456",
      baselineOrdersPerDay: 1,
      baselineConfirmMinutes: 95,
      theme: PALETTES.rose,
      language: "en",
    },
  });
  await member(shop.id, ownerId, "owner");
  await member(shop.id, managerId, "manager");
  await member(shop.id, staffId, "staff");

  const toters = await prisma.courier.create({ data: { shopId: shop.id, type: "COMPANY", name: "Toters", phone: "+9611555666" } });
  const wakilni = await prisma.courier.create({ data: { shopId: shop.id, type: "COMPANY", name: "Wakilni", phone: "+9611333444" } });
  const ali = await prisma.courier.create({ data: { shopId: shop.id, type: "INDIVIDUAL", name: "Ali (motorbike)", phone: "+96171987654" } });
  await member(shop.id, riderId, "delivery", ali.id);

  const flat = (p: Awaited<ReturnType<typeof product>>): Variant[] => p.variants.map((v) => ({ ...v, productName: p.name }));
  const shirt = flat(
    await product(shop.id, "Linen shirt", "Breathable Lebanese linen, cut loose for summer evenings in Gemmayzeh.", [
      { size: "S", colour: "Sand", price: 3500, stock: 6 },
      { size: "M", colour: "Sand", price: 3500, stock: 9 },
      { size: "L", colour: "Sand", price: 3500, stock: 4 },
      { size: "M", colour: "Olive", price: 3500, stock: 5 },
      { size: "L", colour: "Olive", price: 3500, stock: 1 },
    ]),
  );
  const abaya = flat(
    await product(shop.id, "Embroidered abaya", "Hand-embroidered by artisans in Tripoli. One size, relaxed fit.", [
      { colour: "Black", price: 8900, stock: 3 },
      { colour: "Navy", price: 8900, stock: 2 },
    ]),
  );
  const tote = flat(
    await product(shop.id, "Cedar tote bag", "Heavy cotton canvas with a printed cedar. Fits a laptop.", [
      { colour: "Natural", price: 1800, stock: 25 },
      { colour: "Black", price: 1800, stock: 12 },
    ]),
  );
  const scarf = flat(
    await product(shop.id, "Silk keffiyeh scarf", "A silk take on the classic pattern.", [
      { colour: "Red", price: 2900, stock: 7 },
      { colour: "Black", price: 2900, stock: 0 },
    ]),
  );
  const tee = flat(
    await product(shop.id, "Beirut 961 tee", "Organic cotton tee, printed in Bourj Hammoud.", [
      { size: "S", price: 1500, stock: 10 },
      { size: "M", price: 1500, stock: 14 },
      { size: "L", price: 1500, stock: 8 },
      { size: "XL", price: 1500, stock: 3 },
    ]),
  );
  await product(shop.id, "Winter wool coat", "Last season. Archived, kept for old orders.", [{ size: "M", colour: "Camel", price: 12000, stock: 0 }]).then(
    (p) => prisma.product.update({ where: { id: p.id }, data: { status: "ARCHIVED" } }),
  );

  const people: Customer[] = [
    { name: "Maya Haddad", phone: "+96171123456", email: "maya@example.com", governorate: "Beirut", district: "Beirut", area: "Mar Mikhael", addressLine: "Armenia St, Saade bldg, 3rd floor", landmark: "Above the bakery" },
    { name: "Nour Khalil", phone: "+96176234567", governorate: "Mount Lebanon", district: "Metn", area: "Jdeideh", addressLine: "Main road, Hayek bldg, 5th floor", landmark: "Facing Spinneys" },
    { name: "Jad Farah", phone: "+9613345678", email: "jad@example.com", governorate: "Keserwan-Jbeil", district: "Jbeil", area: "Byblos", addressLine: "Old souk street, house 4", landmark: "Behind the church" },
    { name: "Hiba Mansour", phone: "+96170456789", governorate: "North", district: "Tripoli", area: "El Mina", addressLine: "Corniche, Bahri bldg, 2nd floor" },
    { name: "Tarek Aoun", phone: "+96181567890", email: "tarek@example.com", governorate: "Mount Lebanon", district: "Baabda", area: "Hazmieh", addressLine: "Mar Takla street, Clover bldg, 7th floor", landmark: "Next to the pharmacy" },
    { name: "Yasmine Daher", phone: "+96171678901", governorate: "South", district: "Saida", area: "Saida old city", addressLine: "Riad Al Solh street, bldg 9", landmark: "Near the sea castle" },
    { name: "Omar Itani", phone: "+96176789012", governorate: "Beirut", district: "Beirut", area: "Hamra", addressLine: "Makdessi street, Itani bldg, 1st floor" },
    { name: "Carla Gemayel", phone: "+9613890123", email: "carla@example.com", governorate: "Mount Lebanon", district: "Metn", area: "Antelias", addressLine: "Highway service road, bldg 22, 4th floor", landmark: "Opposite the church" },
  ];
  const c = (i: number) => people[i % people.length];
  const courier = (k: typeof toters) => ({ courierId: k.id, courierName: k.name });
  const place = (o: OrderSpec, actor = staffId) => order(shop, actor, o);

  // Delivered over the last three weeks: the ones the reconciliation and metrics use.
  const delivered: Awaited<ReturnType<typeof order>>[] = [];
  const runs: [number, typeof toters, Variant, number][] = [
    [20, toters, shirt[1], 1], [19, wakilni, tote[0], 2], [18, ali, tee[1], 1], [17, toters, abaya[0], 1],
    [16, ali, scarf[0], 1], [15, wakilni, shirt[0], 1], [13, toters, tee[0], 3], [12, ali, tote[1], 1],
    [11, wakilni, shirt[3], 1], [10, toters, tee[2], 2], [9, ali, abaya[1], 1], [8, toters, shirt[2], 1],
    [7, wakilni, scarf[0], 2], [6, ali, tee[1], 1], [5, toters, tote[0], 1], [4, wakilni, shirt[1], 1],
    [3, ali, tee[3], 1], [2, toters, tote[0], 2],
  ];
  for (const [i, [days, k, variant, qty]] of runs.entries()) {
    const extra: Partial<OrderSpec> = {};
    if (i === 3) extra.reportedUsdCents = 9000n; // collected $90.00 of $93.00 at the door: a doorstep gap
    if (i === 8) extra.reportedLbp = 3_400_000n; // paid in pounds instead of dollars
    if (k === ali) extra.deliveredBy = riderId;
    delivered.push(
      await place({ customer: c(i), lines: [{ variant, qty }], status: "DELIVERED", daysAgo: days, ...courier(k), source: i % 4 === 0 ? "MANUAL" : "CATALOGUE", ...extra }),
    );
  }

  // The board today: every status.
  await place({ customer: c(1), lines: [{ variant: shirt[1], qty: 1 }, { variant: tote[1], qty: 1 }], status: "NEW", daysAgo: 0 });
  await place({ customer: c(5), lines: [{ variant: tee[0], qty: 2 }], status: "NEW", daysAgo: 0 });
  await place({ customer: c(6), lines: [{ variant: abaya[0], qty: 1 }], status: "NEW", daysAgo: 1, source: "MANUAL" });
  await place({ customer: c(2), lines: [{ variant: scarf[0], qty: 1 }], status: "CONFIRMED", daysAgo: 1 });
  await place({ customer: c(7), lines: [{ variant: shirt[4], qty: 1 }], status: "CONFIRMED", daysAgo: 1, ...courier(wakilni) });
  await place({ customer: c(3), lines: [{ variant: tee[1], qty: 1 }, { variant: tote[0], qty: 1 }], status: "PACKED", daysAgo: 1, ...courier(ali) });
  await place({ customer: c(4), lines: [{ variant: shirt[0], qty: 1 }], status: "PACKED", daysAgo: 2, ...courier(toters) });
  await place({ customer: c(0), lines: [{ variant: tote[1], qty: 1 }], status: "OUT_FOR_DELIVERY", daysAgo: 1, ...courier(ali) });
  await place({ customer: c(5), lines: [{ variant: tee[2], qty: 1 }], status: "OUT_FOR_DELIVERY", daysAgo: 1, ...courier(toters) });
  await place({ customer: c(6), lines: [{ variant: scarf[0], qty: 1 }], status: "CANCELLED", daysAgo: 3 });
  await place({ customer: c(1), lines: [{ variant: abaya[1], qty: 1 }], status: "RETURNED", daysAgo: 4, ...courier(wakilni), failureReason: "Customer not answering, address closed" });

  // Remittances: Toters paid in full with its fee, Wakilni short on one order, Ali has not handed over the latest runs.
  const remit = async (k: typeof toters, orders: typeof delivered, days: number, reference: string, adjust: (o: (typeof delivered)[number], i: number) => { usd: bigint; lbp?: bigint }, fee = 0n) => {
    const lines = orders.map((o, i) => ({ order: o, ...adjust(o, i) }));
    const usd = lines.reduce((s, l) => s + l.usd, 0n) - fee * BigInt(lines.length);
    await prisma.remittance.create({
      data: {
        shopId: shop.id,
        courierId: k.id,
        amountUsdCents: usd,
        amountLbp: lines.reduce((s, l) => s + (l.lbp ?? 0n), 0n),
        receivedAt: ago(days),
        reference,
        recordedByUserId: managerId,
        lines: {
          create: lines.map((l) => ({ shopId: shop.id, orderId: l.order.id, collectedUsdCents: l.usd, collectedLbp: l.lbp ?? 0n, feeMinor: fee })),
        },
      },
    });
  };
  const by = (k: typeof toters) => delivered.filter((o) => o.courierId === k.id);
  const [t1, t2, t3, t4] = by(toters);
  // t2 is the order where the courier collected $3 short at the door; they hand over what they took.
  await remit(toters, [t1, t2, t3], 9, "TOT-2210", (o) => ({ usd: o.reportedUsdCents ?? o.codMinor }), 300n);
  await remit(toters, [t4], 3, "TOT-2241", (o) => ({ usd: o.codMinor }), 300n);
  const w = by(wakilni);
  await remit(wakilni, w.slice(0, 4), 5, "WK-88213", (o, i) => (i === 2 ? { usd: 0n, lbp: 3_400_000n } : i === 1 ? { usd: o.codMinor - 500n } : { usd: o.codMinor }));
  await remit(ali, by(ali).slice(0, 3), 6, "Cash in hand", (o) => ({ usd: o.codMinor }));

  // Reviews on some delivered orders, one hidden by the owner; and open invites.
  const comments = ["Perfect fit and fast delivery!", "Beautiful quality, will order again.", "Colour a bit darker than the photo.", "The rider was very kind.", null, "Love it ❤️"];
  for (const [i, o] of delivered.slice(0, 10).entries()) {
    const items = await prisma.orderItem.findMany({ where: { orderId: o.id }, include: { variant: true } });
    const rating = [5, 5, 4, 5, 3, 5, 4, 2, 5, 4][i];
    await prisma.reviewInvite.create({
      data: { shopId: shop.id, orderId: o.id, tokenHash: hashToken(randomToken()), expiresAt: new Date(o.deliveredAt!.getTime() + 30 * DAY), emailSentAt: o.customerEmail ? o.deliveredAt : null, usedAt: i < 8 ? ago(1) : null },
    });
    if (i >= 8) continue;
    for (const item of items) {
      await prisma.review.create({
        data: {
          shopId: shop.id,
          productId: item.variant.productId,
          orderItemId: item.id,
          rating,
          comment: comments[i % comments.length],
          authorName: reviewAuthorName(o.customerName),
          createdAt: new Date(o.deliveredAt!.getTime() + DAY),
          ...(rating === 2 ? { status: "HIDDEN" as const, hiddenByUserId: ownerId, hiddenAt: ago(1) } : {}),
        },
      });
    }
  }
  const stats = await prisma.review.groupBy({ by: ["productId"], where: { shopId: shop.id, status: "PUBLISHED" }, _avg: { rating: true }, _count: true });
  for (const s of stats) {
    await prisma.product.update({ where: { id: s.productId }, data: { ratingAvg: new Prisma.Decimal((s._avg.rating ?? 0).toFixed(2)), ratingCount: s._count } });
  }

  // A pending invite for a new staff member.
  await prisma.invitation.create({
    data: { id: hashToken(randomToken()), shopId: shop.id, email: "new.staff@example.com", role: "staff", status: "pending", expiresAt: new Date(now + 7 * DAY), inviterId: ownerId },
  });

  // Second shop: Arabic catalogue priced in pounds (shows tenant isolation in the demo).
  const zaatar = await prisma.shop.create({
    data: {
      id: crypto.randomUUID(),
      name: "زعتر وزيت",
      slug: "zaatar-w-zeit",
      currency: "LBP",
      usdLbpRate: new Prisma.Decimal("89500"),
      deliveryFeeMinor: 200_000n,
      language: "ar",
      theme: PALETTES.cedar,
      baselineOrdersPerDay: 3,
      baselineConfirmMinutes: 60,
    },
  });
  await member(zaatar.id, zaatarOwnerId, "owner");
  const z = flat(
    await product(zaatar.id, "زعتر بلدي", "زعتر من جبال الجنوب، مطحون مع السماق والسمسم.", [
      { size: "250g", price: 450_000, stock: 40 },
      { size: "500g", price: 850_000, stock: 25 },
    ]),
  );
  const oil = flat(await product(zaatar.id, "زيت زيتون بكر", "عصرة أولى من الكورة.", [{ size: "1L", price: 1_200_000, stock: 15 }]));
  const zCourier = await prisma.courier.create({ data: { shopId: zaatar.id, type: "INDIVIDUAL", name: "أبو حسن", phone: "+96170111222" } });
  await order(zaatar, zaatarOwnerId, { customer: c(3), lines: [{ variant: z[0], qty: 2 }], status: "NEW", daysAgo: 0 });
  await order(zaatar, zaatarOwnerId, { customer: c(5), lines: [{ variant: oil[0], qty: 1 }, { variant: z[1], qty: 1 }], status: "DELIVERED", daysAgo: 2, courierId: zCourier.id, courierName: zCourier.name });

  console.log(`
Seeded. Every account's password is "${PASSWORD}".
  owner@demo.shoplink.lb    Owner of Beirut Threads   -> /dashboard
  manager@demo.shoplink.lb  Manager                   -> /dashboard
  staff@demo.shoplink.lb    Staff                     -> /dashboard
  rider@demo.shoplink.lb    Delivery (Ali, motorbike) -> /dashboard/deliveries
  admin@demo.shoplink.lb    Platform admin            -> /admin
  zaatar@demo.shoplink.lb   Owner of the Arabic shop  -> /dashboard
Catalogues: /s/${SLUG} and /s/zaatar-w-zeit`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
