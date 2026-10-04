## 1. Database & Configuration

- [ ] 1.1 Add `ADMIN_PASSWORD` validation in `src/config.ts`
- [ ] 1.2 Add `channels` table migration in `src/db/migrations.ts`
- [ ] 1.3 Create `ChannelRepository` in `src/db/repositories/channels.ts` with tests
- [ ] 1.4 Implement startup channel seeding from configured `FAMILY_CHAT_IDS`

## 2. Channel Delivery & Runtime Gating

- [ ] 2.1 Update `handleDelivery` in `src/delivery.ts` to auto-record new channels as `pending`
- [ ] 2.2 Enforce channel status gating in `handleDelivery` (`pending` approval notice, `active` conversation, `disabled` silent)
- [ ] 2.3 Add unit and integration tests verifying channel status gating

## 3. Fastify Admin Backend API

- [ ] 3.1 Implement admin authentication middleware and `POST /api/admin/login`
- [ ] 3.2 Implement channels API (`GET /api/admin/channels`, `PATCH /api/admin/channels/:chatId`)
- [ ] 3.3 Implement messages API (`GET /api/admin/channels/:chatId/messages`, `POST /api/admin/channels/:chatId/messages`)
- [ ] 3.4 Implement reminders/events API (`GET /api/admin/channels/:chatId/events`, `POST`, `DELETE`)
- [ ] 3.5 Implement memories API (`GET /api/admin/channels/:chatId/memories`, `POST`, `DELETE`)
- [ ] 3.6 Mount admin API routes in `src/server.ts` and add API tests

## 4. React + Vite Admin SPA

- [ ] 4.1 Scaffold React + Vite application in `web/` with TypeScript and modern design system
- [ ] 4.2 Build authentication flow with Login page and session handling
- [ ] 4.3 Build Channels list component with search, status filters (Pending/Active/Disabled), and quick actions
- [ ] 4.4 Build Channel detail view with Messages log & direct send, Reminders manager, and Memory manager tabs
- [ ] 4.5 Configure Fastify to serve compiled SPA assets at `/admin` with SPA route fallback

## 5. Verification & Final Polish

- [ ] 5.1 Test full end-to-end flow: discovery of new channel -> admin approval -> bot conversation
- [ ] 5.2 Verify production build scripts and containerization compatibility
