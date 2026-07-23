## Overview

This backend is scaffolded as a central Laravel 11 app plus tenant applications using `stancl/tenancy` v3.

### Central side

- Central tenant registry and domain registry live in the central database.
- Central REST endpoints live under `routes/api.php`.
- Example endpoints:
  - `GET /api/v1/tenants`
  - `POST /api/v1/tenants`
  - `GET /api/v1/tenants/{tenant}`
  - `PATCH /api/v1/tenants/{tenant}`
  - `POST /api/v1/tenants/{tenant}/domains`

### Tenant side

- Tenant REST endpoints live under `routes/tenant.php`.
- Example endpoints:
  - `GET /api/v1/meta`
  - `GET /api/v1/barbers`
  - `POST /api/v1/barbers`

## Local development

### 1. Enter the backend

```bash
cd laravel-app
```

### 2. Central database

Current local setup uses SQLite for the central app and tenant databases.

```bash
php artisan migrate:fresh --force
```

### 3. Create a sample tenant

```bash
php scripts/smoke_create_tenant.php
php artisan tenants:migrate --force
```

This creates:

- a central tenant record
- a domain `demo.localhost`
- a tenant SQLite database file
- tenant tables for booking, settings, and communications

### 4. Run the backend

```bash
php artisan serve
```

Central API will be available on:

```text
http://127.0.0.1:8000/api/v1/tenants
```

## Production direction

For production, switch central and tenant databases to MySQL or PostgreSQL by setting:

- `CENTRAL_DB_*`
- `TENANT_DB_*`
- `CENTRAL_DOMAINS`

Recommended production shape:

- central admin domain: `admin.yourapp.com`
- tenant custom domains: each barbershop domain mapped into the `domains` table

## Next implementation steps

1. Add central auth for super admin.
2. Replace placeholder tenant routes with full resources for services, customers, appointments, settings, payments, and sms.
3. Add request classes, policies, actions, and resources per domain module.
4. Move the current React frontend to consume this REST API.
5. Add provisioning workflow from central admin UI for creating a barbershop and attaching domains.
