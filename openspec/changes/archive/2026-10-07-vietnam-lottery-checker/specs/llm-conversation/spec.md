# Spec Delta

## ADDED Requirements

### Requirement: Lottery ticket photo recognition and checking workflow
The system SHALL equip the LLM with lottery lookup tools and system prompt guidance so that when a user provides a photo of a Vietnamese lottery ticket, the assistant extracts the station, draw date, and ticket numbers, verifies the ticket via the lottery tool, and responds with a friendly Vietnamese result summary adhering to plain-text formatting constraints.

#### Scenario: User sends photo of lottery ticket
- **WHEN** a user sends an image of a Vietnamese lottery ticket asking to check results
- **THEN** the model inspects the ticket details from the image, invokes the lottery checking tool with the extracted station, date, and ticket number, and presents the winning outcome clearly to the user

#### Scenario: Unclear ticket image or missing details
- **WHEN** the image is too blurry to reliably read the ticket number, station, or draw date
- **THEN** the model politely explains which details could not be read and asks the user to confirm or re-enter the station, date, or number
