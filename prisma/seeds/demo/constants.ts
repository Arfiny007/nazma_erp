/** Marker prefix for demo dealer mobiles — used by reset. */
export const DEMO_MOBILE_PREFIX = "0199DEMO";

/** Demo order numbers use this prefix for safe reset. */
export const DEMO_ORDER_PREFIX = "DEMO-ORD-";

/** Demo challan numbers use this prefix for safe reset. */
export const DEMO_CHALLAN_PREFIX = "DEMO-CHL-";

export const DEMO_EMAIL_DOMAIN = "@nazma.test";

export const DEMO_PASSWORD = "Demo123!";

export const SALT_ROUNDS = 12;

/** Districts emphasized in the enterprise demo dataset. */
export const TARGET_DISTRICT_CODES = [
  "dhaka",
  "gazipur",
  "chattogram",
  "cumilla",
  "narayanganj",
] as const;

export const DEMO_USER_SPECS = [
  { name: "Demo Super Admin", email: "admin@nazma.test", role: "Super_Admin" as const },
  { name: "Demo Manager One", email: "manager1@nazma.test", role: "Manager" as const },
  { name: "Demo Manager Two", email: "manager2@nazma.test", role: "Manager" as const },
  { name: "Demo SR One", email: "sr1@nazma.test", role: "SR" as const },
  { name: "Demo SR Two", email: "sr2@nazma.test", role: "SR" as const },
  { name: "Demo SR Three", email: "sr3@nazma.test", role: "SR" as const },
  { name: "Demo SR Four", email: "sr4@nazma.test", role: "SR" as const },
  { name: "Demo SR Five", email: "sr5@nazma.test", role: "SR" as const },
  { name: "Demo SR Six", email: "sr6@nazma.test", role: "SR" as const },
  { name: "Demo Accounts One", email: "accounts1@nazma.test", role: "Accounts" as const },
  { name: "Demo Accounts Two", email: "accounts2@nazma.test", role: "Accounts" as const },
] as const;

export const DEMO_COUNTS = {
  dealers: 50,
  products: 30,
  orders: 155,
  challans: 110,
  invoices: 125,
  collections: 105,
  openingBalances: 10,
} as const;
