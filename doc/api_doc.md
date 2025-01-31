# API Documentation

## Table of Contents
1. [Assistant Operations](#1-assistant-operations)
2. [Thread Operations](#2-thread-operations)
3. [Vector Store Operations](#3-vector-store-operations)
4. [File Operations](#4-file-operations)
5. [Error Handling](#5-error-handling)

## 1. Assistant Operations

### Create Assistant
Creates a new AI assistant.

**Request**
```
POST /api/assistant
```

**Request Body Parameters**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| name | string | No | Name of the assistant (defaults to "File Handler") |
| instructions | string | No | Custom instructions for the assistant |
| model | string | No | The model to use (defaults to "gpt-4o") |

**Example Request**
```json
{
    "name": "Custom Assistant",
    "instructions": "You are a helpful assistant that can process and analyze files.",
    "model": "gpt-4o"
}
```

**Example Response**
```json
{
    "id": "asst_abc123",
    "name": "Custom Assistant",
    "instructions": "You are a helpful assistant that can process and analyze files.",
    "model": "gpt-4o",
    "tools": [{"type": "file_search"}]
}
```

### Get Assistant Details
Retrieves details about a specific assistant.

**Request**
```
GET /api/assistant/:assistantId
```

**Path Parameters**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| assistantId | string | Yes | The ID of the assistant |

## 2. Thread Operations

### Create Thread
Creates a new conversation thread.

**Request**
```
POST /api/thread
```

**Example Response**
```json
{
    "id": "thread_abc123",
    "created_at": "2024-03-15T12:00:00Z"
}
```

### Send Message to Thread
Sends a message to an existing thread and gets the assistant's response.

**Request**
```
POST /api/thread/:threadId/message
```

**Path Parameters**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| threadId | string | Yes | The ID of the thread |

**Request Body Parameters**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| assistantId | string | Yes | The ID of the assistant to respond |
| message | string | Yes | The message content |

**Example Request**
```json
{
    "assistantId": "asst_abc123",
    "message": "Can you analyze this data?"
}
```

### Get Thread Messages
Retrieves all messages in a thread.

**Request**
```
GET /api/thread/:threadId/messages
```

### Get Run Status
Checks the status of a specific run.

**Request**
```
GET /api/thread/:threadId/run/:runId
```

## 3. Vector Store Operations

### Create Vector Store
Creates a new vector store for file embeddings.

**Request**
```
POST /api/vectorstore
```

**Request Body Parameters**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| name | string | No | Name of the vector store (defaults to "Default Vector Store") |

### Upload Files to Vector Store
Uploads files to a vector store for processing.

**Request**
```
POST /api/vectorstore/:vectorStoreId/files
```

**Form Data Parameters**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| files | file[] | Yes | Array of files to upload |

### List Vector Stores
Retrieves all vector stores.

**Request**
```
GET /api/vectorstore
```

### Get Vector Store Details
Retrieves details about a specific vector store.

**Request**
```
GET /api/vectorstore/:vectorStoreId
```

### Delete Vector Store
Deletes a vector store.

**Request**
```
DELETE /api/vectorstore/:vectorStoreId
```

### List Files in Vector Store
Lists all files in a vector store.

**Request**
```
GET /api/vectorstore/:vectorStoreId/files
```

### Remove File from Vector Store
Removes a file from a vector store.

**Request**
```
DELETE /api/vectorstore/:vectorStoreId/files/:fileId
```

## 4. File Operations

### Create Thread with File
Creates a new thread with an initial message and file attachment.

**Request**
```
POST /api/thread/with-file
```

**Form Data Parameters**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| file | file | Yes | File to upload |
| message | string | Yes | Initial message |

### Add File Message to Thread
Adds a message with a file attachment to an existing thread.

**Request**
```
POST /api/thread/:threadId/message-with-file
```

**Form Data Parameters**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| file | file | Yes | File to upload |
| message | string | Yes | Message content |

## 5. Error Handling

All endpoints may return the following error responses:

### 400 Bad Request
```json
{
    "error": "Invalid request parameters"
}
```

### 500 Internal Server Error
```json
{
    "error": "Error message details",
    "type": "error_type",
    "code": "error_code"
}
```

### 504 Gateway Timeout
```json
{
    "error": "Assistant response timeout"
}
```

## Rate Limiting
The API implements standard rate limiting. When exceeded, you'll receive a 429 Too Many Requests response.

## Authentication
All requests must include an OpenAI API key in the environment variables.

## File Handling
- Supported file formats depend on OpenAI's file processing capabilities
- Files are temporarily stored and automatically cleaned up after processing
- Maximum file size limits apply based on OpenAI's restrictions
