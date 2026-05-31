<!-- BEGIN:nextjs-agent-rules -->
# AGENTS.md
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.



## Purpose

This file defines the behavior rules for AI coding agents working inside the Nazma Water Taps ERP codebase.

The AI agent must treat this document as authoritative.

---

# Core Mission

Build a production-grade ERP platform for Nazma Metal Industries.

Objectives:

* Financial accuracy
* Enterprise UX
* Type safety
* Clean architecture
* Docker-first deployment
* English/Bengali localization
* Long-term maintainability

---

# Technology Constraints

Mandatory:

* Next.js App Router
* TypeScript Strict Mode
* Tailwind CSS
* Prisma ORM
* PostgreSQL
* Auth.js
* Zod
* React Hook Form

Never introduce:

* JavaScript files
* any type
* Sequelize
* Mongoose
* Redux
* Floating point monetary calculations

---

# Financial Rules

All monetary values must use:

Decimal @db.Decimal(18,2)

Never use:

Float
Double
number

for database monetary fields.

---

# Database Rules

Read schema.prisma before creating models.

Never invent tables.

Never create duplicate entities.

Always extend existing models.

---

# UI Rules

Design language:

* Stripe
* Linear
* Vercel Enterprise

Requirements:

* Responsive
* Accessible
* Premium appearance
* Skeleton loading states
* Empty states
* Error boundaries

No basic admin-template styling.

---

# Localization Rules

Every user-facing string must support localization.

Never hardcode text directly inside components.

Use translation keys.

---

# Coding Rules

Always:

* Use strict TypeScript
* Create interfaces
* Use server actions where appropriate
* Create reusable components

Never:

* Use any
* Ignore ESLint
* Ignore TypeScript errors

---

# Before Creating Code

Read:

1. ARCHITECTURE.md
2. PROJECT_BRAIN.md
3. CURRENT_PHASE.md

before generating files.

<!-- END:nextjs-agent-rules -->
