# Requirements Document

## Introduction

This specification defines the requirements for an n8n workflow system that can send PDF files to external Lark groups. The system needs to handle PDF file processing, generate appropriate messaging cards for external groups (which cannot receive files directly), and provide users with methods to access the files.

## Glossary

- **N8N_Workflow**: The n8n automation workflow system
- **Lark_External_Group**: A Lark/Feishu group that contains external users who cannot access internal file resources directly
- **PDF_File**: Portable Document Format files that need to be sent to the group
- **Webhook_Card**: Interactive message card sent via Lark webhook that displays file information
- **File_Access_Method**: The mechanism by which external users can obtain the PDF files
- **Backend_Service**: The existing backend service running on port 8000 that can provide file download capabilities

## Requirements

### Requirement 1: PDF File Processing

**User Story:** As a workflow operator, I want to process PDF files in n8n, so that I can prepare them for distribution to external Lark groups.

#### Acceptance Criteria

1. WHEN a PDF file is provided to the workflow, THE N8N_Workflow SHALL detect and validate the PDF file format
2. WHEN multiple PDF files are provided, THE N8N_Workflow SHALL process all files and maintain their binary data
3. WHEN processing PDF files, THE N8N_Workflow SHALL extract file metadata including file name, size, and creation timestamp
4. WHEN file processing is complete, THE N8N_Workflow SHALL preserve all binary data for downstream nodes
5. IF a file is not a valid PDF, THEN THE N8N_Workflow SHALL log an error and continue processing other files

### Requirement 2: External Group Message Generation

**User Story:** As an external group member, I want to receive clear information about available PDF files, so that I know what files are available and how to access them.

#### Acceptance Criteria

1. WHEN PDF files are ready for distribution, THE N8N_Workflow SHALL generate a Webhook_Card containing file information
2. WHEN displaying file information, THE Webhook_Card SHALL show file names, count, and generation timestamp
3. WHEN creating the card for external groups, THE N8N_Workflow SHALL include clear instructions for file access
4. WHEN multiple files are available, THE Webhook_Card SHALL list all file names in a readable format
5. WHEN generating the card, THE N8N_Workflow SHALL use appropriate visual formatting with icons and structured layout

### Requirement 3: File Access Method Implementation

**User Story:** As an external group member, I want to easily access PDF files mentioned in the group, so that I can download and view the documents.

#### Acceptance Criteria

1. WHERE the Backend_Service is available, THE N8N_Workflow SHALL generate direct download links for each PDF file
2. WHEN download links are available, THE Webhook_Card SHALL include clickable buttons for immediate file download
3. WHEN Backend_Service is not available, THE Webhook_Card SHALL provide file IDs and contact information for manual access
4. WHEN users click download buttons, THE system SHALL initiate direct file download without additional authentication
5. IF download fails, THEN THE system SHALL provide alternative access methods and contact information

### Requirement 4: Webhook Message Delivery

**User Story:** As a workflow operator, I want to reliably send messages to external Lark groups, so that all group members receive the file notifications.

#### Acceptance Criteria

1. WHEN the Webhook_Card is ready, THE N8N_Workflow SHALL send it to the specified Lark webhook URL
2. WHEN sending the webhook, THE N8N_Workflow SHALL use proper HTTP headers and JSON formatting
3. WHEN the webhook is sent successfully, THE system SHALL receive a confirmation response from Lark
4. IF the webhook delivery fails, THEN THE N8N_Workflow SHALL log the error and provide diagnostic information
5. WHEN webhook delivery is complete, THE N8N_Workflow SHALL preserve all file data for potential retry or alternative delivery

### Requirement 5: Backend Integration for File Downloads

**User Story:** As a system administrator, I want to provide seamless file access through the existing backend, so that external users can download files without complex authentication.

#### Acceptance Criteria

1. WHEN the Backend_Service is running, THE N8N_Workflow SHALL generate download URLs using the backend endpoint pattern
2. WHEN creating download URLs, THE system SHALL use the format `http://localhost:8000/download/{fileKey}`
3. WHEN Backend_Service receives download requests, THE system SHALL authenticate with Lark API using stored credentials
4. WHEN serving files, THE Backend_Service SHALL set appropriate headers for PDF file download
5. IF Backend_Service is unavailable, THEN THE N8N_Workflow SHALL fall back to manual access instructions

### Requirement 6: Error Handling and Resilience

**User Story:** As a workflow operator, I want the system to handle errors gracefully, so that partial failures don't prevent successful file distribution.

#### Acceptance Criteria

1. WHEN file processing encounters errors, THE N8N_Workflow SHALL continue processing remaining files
2. WHEN webhook delivery fails, THE system SHALL provide clear error messages and suggested remediation steps
3. WHEN Backend_Service is unreachable, THE N8N_Workflow SHALL automatically switch to manual access mode
4. WHEN invalid file formats are detected, THE system SHALL skip them and report the issue without stopping the workflow
5. WHEN any component fails, THE N8N_Workflow SHALL log sufficient information for troubleshooting

### Requirement 7: Configuration and Flexibility

**User Story:** As a workflow administrator, I want to easily configure the system for different environments and use cases, so that it can adapt to various deployment scenarios.

#### Acceptance Criteria

1. WHEN configuring the workflow, THE system SHALL allow customization of webhook URLs for different Lark groups
2. WHEN setting up Backend_Service integration, THE system SHALL support both localhost and remote backend URLs
3. WHEN customizing messages, THE N8N_Workflow SHALL allow modification of card templates and text content
4. WHEN deploying in different environments, THE system SHALL support environment-specific configuration
5. WHEN Backend_Service is disabled, THE system SHALL gracefully operate in manual-only mode