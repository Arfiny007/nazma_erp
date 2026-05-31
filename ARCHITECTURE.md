# Nazma Water Taps ERP - System Architecture

## Project Overview

Nazma Water Taps ERP is a premium B2B Sales, Collection, Dealer Management, Invoice, and Financial Ledger Management System for Nazma Metal Industries.

Primary objectives:

* Dealer lifecycle management
* Sales order workflow
* Invoice generation
* Collection management
* Financial ledger tracking
* Credit limit monitoring
* Audit logging
* English/Bengali localization
* Docker-based deployment

---

# Technology Stack

## Frontend

* Next.js 15 (App Router)
* React 19
* TypeScript
* Tailwind CSS
* Shadcn UI
* TanStack Table
* React Hook Form
* Zod

## Backend

* Next.js Route Handlers
* Server Actions
* Prisma ORM

## Database

* PostgreSQL 16

## Authentication

* Auth.js

## Storage

* Local Storage (Development)
* MinIO/S3 Compatible Storage (Production)

## Containerization

* Docker
* Docker Compose

---

# Why This Stack

This stack is optimized for Cursor Pro because:

1. Strong TypeScript typing improves Cursor code indexing.
2. Prisma schema becomes a single source of truth.
3. Next.js App Router provides predictable file structures.
4. Tailwind + Shadcn allows consistent enterprise UI generation.
5. PostgreSQL handles financial workloads reliably.
6. Docker guarantees environment consistency.

---

# User Roles

```prisma
enum UserRole {
  Super_Admin
  Manager
  Accounts
  SR
}
```

---

# Financial Rules

## Mandatory Rules

All financial values MUST use Decimal.

Never use:

* Float
* Double
* number for database calculations

Use:

```prisma
Decimal @db.Decimal(18,2)
```

Examples:

```prisma
amount Decimal @db.Decimal(18,2)
vat Decimal @db.Decimal(18,2)
balance Decimal @db.Decimal(18,2)
creditLimit Decimal @db.Decimal(18,2)
```

---



