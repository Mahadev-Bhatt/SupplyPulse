# SupplyPulse (Spring Boot, Java 17 + Angular 18)

REST backend for the SupplyPulse SRS: inventory visibility, forecasts, replenishment with planner approval,
shipments, supplier scorecards, alerts and what-if scenarios. Data is in memory; swap `DataStore` for a database
and ERP/IoT adapters.

## Run
Backend (port 8080):

    mvn spring-boot:run

Frontend (port 4200, proxies /api to the backend; needs Node 18.19+):

    cd frontend
    npm install
    npm start

Open http://localhost:4200 and sign in as planner@acme.test (any 8+ character password, any 6-digit code).
The sign-in token is held in memory only, so a page refresh signs you out.

## Try it
    TOKEN=$(curl -s -X POST localhost:8080/api/auth/login -H 'Content-Type: application/json' \
      -d '{"email":"planner@acme.test","password":"Sup-ply-Pulse-26","otp":"123456"}' | sed 's/.*"token":"\([^"]*\)".*/\1/')
    curl -H "Authorization: Bearer $TOKEN" localhost:8080/api/items
    curl -H "Authorization: Bearer $TOKEN" localhost:8080/api/replenishment
    curl -X POST -H "Authorization: Bearer $TOKEN" localhost:8080/api/replenishment/SKU-1001/approve

Accounts: planner@, buyer@, wh@, exec@, steward@, admin@ acme.test (password 8+ chars, any 6-digit code).

## Endpoints
POST /api/auth/login, POST /api/auth/logout, GET /api/me, GET /api/items?q=&page=&size=, GET /api/items/{sku}/forecast,
GET /api/replenishment, POST /api/replenishment/{sku}/approve (planner/admin), GET /api/shipments, GET /api/suppliers,
GET /api/alerts, POST /api/alerts/{id}/claim, POST /api/alerts/{id}/close, POST /api/scenarios.

## SRS rules covered
Invitation-only sign-in with second factor and lock-out (FR-WEB-02/04, FR-AUTH-04), generic login error, server-side roles,
capped paging, one error body with trace id and X-Correlation-Id header (NFR-API-03/10), approval before any order (T17-FR-05),
idempotent approval, alert ownership and closing with an action (T17-FR-09), read-only scenarios (T17-FR-08).

## Frontend
Standalone Angular components with lazy-loaded routes: login, dashboard, inventory, forecast chart, replenishment with approval,
shipments, suppliers, scenarios, alerts. A route guard and role-aware navigation mirror server rules; the server still enforces access.
An HTTP interceptor adds the bearer token and returns to sign-in on any 401. Errors show the trace id.

## Not yet built
Database and migrations, ERP/IoT connectors, field encryption, audit log, real AI models, OpenAPI file, tests.
