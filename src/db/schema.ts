import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  numeric,
  date,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// "blade_ratchet" = a ratchet-integrated blade (e.g. Hellsnether): the blade
// and ratchet are one fused physical part with no separate ratchet piece.
export const partType = pgEnum("part_type", ["blade", "ratchet", "bit", "blade_ratchet"]);

export const parts = pgTable(
  "parts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: partType("type").notNull(),
    name: text("name").notNull(),
    productLine: text("product_line"),
    series: text("series"),
    attack: integer("attack"),
    defense: integer("defense"),
    stamina: integer("stamina"),
    height: integer("height"), // ratchets: printed "height" stat
    dash: integer("dash"), // bits: printed "dash" stat
    burstResistance: integer("burst_resistance"), // bits: printed "burst resistance" stat
    // Some parts (e.g. a ratchet-integrated blade with a manual height-change
    // gimmick) print two stat profiles — attack/defense/stamina above are the
    // primary ("Normal Mode") numbers, these are the alternate ("Low Mode") ones.
    attackLow: integer("attack_low"),
    defenseLow: integer("defense_low"),
    staminaLow: integer("stamina_low"),
    weightG: numeric("weight_g", { precision: 5, scale: 2 }),
    imageUrl: text("image_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("parts_type_name_idx").on(t.type, t.name)],
);

export const inventory = pgTable(
  "inventory",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    partId: uuid("part_id")
      .notNull()
      .references(() => parts.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull().default(1),
    boxId: uuid("box_id"),
    // Groups rows belonging to the same physical beyblade within a
    // multi-bey (Deck Set) box, since parts-per-bey can vary (a
    // ratchet-integrated blade has no separate ratchet row).
    beyIndex: integer("bey_index"),
    boxCode: text("box_code"),
    boxName: text("box_name"),
    boxPhotoFrontUrl: text("box_photo_front_url"),
    boxPhotoBackUrl: text("box_photo_back_url"),
    partPhotoUrl: text("part_photo_url"),
    notes: text("notes"),
    acquiredAt: date("acquired_at"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("inventory_user_id_idx").on(t.userId)],
);

export const builds = pgTable(
  "builds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    bladePartId: uuid("blade_part_id")
      .notNull()
      .references(() => parts.id),
    // Null when bladePartId is a ratchet-integrated blade (no separate ratchet).
    ratchetPartId: uuid("ratchet_part_id").references(() => parts.id),
    bitPartId: uuid("bit_part_id")
      .notNull()
      .references(() => parts.id),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("builds_user_id_idx").on(t.userId)],
);
