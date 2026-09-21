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

export const partType = pgEnum("part_type", ["blade", "ratchet", "bit"]);

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
    boxCode: text("box_code"),
    boxName: text("box_name"),
    boxPhotoUrl: text("box_photo_url"),
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
    ratchetPartId: uuid("ratchet_part_id")
      .notNull()
      .references(() => parts.id),
    bitPartId: uuid("bit_part_id")
      .notNull()
      .references(() => parts.id),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("builds_user_id_idx").on(t.userId)],
);
