## ADDED Requirements

### Requirement: Gemini image model configuration
The system SHALL support inspecting and customizing the Gemini image generation model via admin REST endpoints (`GET /api/admin/settings`, `PATCH /api/admin/settings`) and the Admin Settings UI, persisting custom values in the `system_settings` table under `gemini_image_model`.

#### Scenario: Retrieve settings with geminiImageModel
- **WHEN** authenticated admin requests `GET /api/admin/settings`
- **THEN** response includes `geminiImageModel` (effective model name, defaulting to `imagen-3.0-generate-002` or `GEMINI_IMAGE_MODEL` env) and source indicator

#### Scenario: Update geminiImageModel via PATCH
- **WHEN** authenticated admin sends `PATCH /api/admin/settings` with `{ "geminiImageModel": "imagen-3.0-generate-002" }`
- **THEN** system persists `gemini_image_model` into `system_settings` and updates effective settings immediately

#### Scenario: Admin views and edits Gemini Image Model in UI
- **WHEN** admin navigates to the Settings page in the Admin SPA
- **THEN** an input for Gemini Image Model is displayed under the AI Settings section allowing the model identifier to be updated and saved
