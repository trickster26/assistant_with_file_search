const express = require('express');
const OpenAI = require('openai');
const multer = require('multer');
const axios = require('axios');
const fs = require('fs');
require('dotenv').config();
const FormData = require('form-data');

const app = express();
const upload = multer({ dest: 'uploads/' });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(express.json());

// Helper function to handle file cleanup
const cleanupUploadedFile = (filePath) => {
  fs.unlink(filePath, (err) => {
    if (err) console.error('Error deleting temporary file:', err);
  });
};


// Create a new assistant
app.post('/api/assistant', async (req, res) => {
  try {
    const assistant = await openai.beta.assistants.create({
      name: req.body.name || "File Handler",
      instructions: req.body.instructions || "You are a helpful assistant that can process and analyze files.",
      model: req.body.model || "gpt-4o",
      tools: [{ type: "file_search" }]
    });
    res.json(assistant);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get assistant details
app.get('/api/assistant/:assistantId', async (req, res) => {
  try {
    const assistant = await openai.beta.assistants.retrieve(
      req.params.assistantId
    );
    res.json(assistant);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new thread
app.post('/api/thread', async (req, res) => {
  try {
    const thread = await openai.beta.threads.create();
    res.json(thread);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send message to assistant and get response
app.post('/api/thread/:threadId/message', async (req, res) => {
  try {
    const { assistantId, message } = req.body;
    if (!assistantId || !message) {
      return res.status(400).json({ error: 'Assistant ID and message are required' });
    }

    // Add message to thread
    await openai.beta.threads.messages.create(
      req.params.threadId,
      {
        role: "user",
        content: message
      }
    );

    // Run the assistant
    const run = await openai.beta.threads.runs.create(
      req.params.threadId,
      { assistant_id: assistantId }
    );

    // Poll for completion
    let runStatus = await openai.beta.threads.runs.retrieve(
      req.params.threadId,
      run.id
    );

    // Wait for the run to complete (with timeout)
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds timeout
    while (runStatus.status !== 'completed' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      runStatus = await openai.beta.threads.runs.retrieve(
        req.params.threadId,
        run.id
      );
      attempts++;
    }

    if (runStatus.status !== 'completed') {
      return res.status(504).json({ error: 'Assistant response timeout' });
    }

    // Get messages after completion
    const messages = await openai.beta.threads.messages.list(
      req.params.threadId
    );

    // Get the latest assistant message
    const assistantMessages = messages.data
      .filter(msg => msg.role === 'assistant')
      .map(msg => msg.content)
      .flat();

    res.json({
      response: assistantMessages[0],
      thread_id: req.params.threadId,
      run_id: run.id
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all messages in a thread
app.get('/api/thread/:threadId/messages', async (req, res) => {
  try {
    const messages = await openai.beta.threads.messages.list(
      req.params.threadId
    );
    res.json(messages.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get run status
app.get('/api/thread/:threadId/run/:runId', async (req, res) => {
  try {
    const run = await openai.beta.threads.runs.retrieve(
      req.params.threadId,
      req.params.runId
    );
    res.json(run);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Vector Store Operations

// Create a new vector store
app.post('/api/vectorstore', async (req, res) => {
  try {
    const vectorStore = await openai.beta.vectorStores.create({
      name: req.body.name || "Default Vector Store"
    });
    res.json(vectorStore);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload files to vector store
app.post('/api/vectorstore/:vectorStoreId/files', upload.array('files'), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // First, upload files to OpenAI with proper file names
    const uploadPromises = req.files.map(async (file) => {
      // Create a new path with the original filename to preserve extension
      const newPath = file.path + '-' + file.originalname;
      await fs.promises.rename(file.path, newPath);
      
      const uploadedFile = await openai.files.create({
        file: fs.createReadStream(newPath),
        purpose: 'assistants'
      });

      // Clean up the renamed file
      cleanupUploadedFile(newPath);
      return uploadedFile.id;
    });

    const fileIds = await Promise.all(uploadPromises);
    console.log("Uploaded file IDs:", fileIds);

    // Create batch with file IDs
    const batch = await openai.beta.vectorStores.fileBatches.createAndPoll(
      req.params.vectorStoreId,
      { file_ids: fileIds }
    );

    res.json({ 
      message: 'Files uploaded and processed successfully',
      vectorStoreId: req.params.vectorStoreId,
      fileIds: fileIds,
      batch: batch
    });
  } catch (error) {
    // Cleanup files in case of error
    if (req.files) {
      req.files.forEach(file => {
        cleanupUploadedFile(file.path);
        cleanupUploadedFile(file.path + '-' + file.originalname);
      });
    }
    console.error('Error details:', error);
    res.status(500).json({ 
      error: error.message,
      type: error.type,
      code: error.code
    });
  }
});

// List all vector stores
app.get('/api/vectorstore', async (req, res) => {
  try {
    const vectorStores = await openai.beta.vectorStores.list();
    res.json(vectorStores.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get vector store details
app.get('/api/vectorstore/:vectorStoreId', async (req, res) => {
  try {
    const vectorStore = await openai.beta.vectorStores.retrieve(
      req.params.vectorStoreId
    );
    res.json(vectorStore);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete vector store
app.delete('/api/vectorstore/:vectorStoreId', async (req, res) => {
  try {
    await openai.beta.vectorStores.del(req.params.vectorStoreId);
    res.json({ message: 'Vector store deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update assistant with vector store
app.post('/api/assistant/:assistantId/vectorstore/:vectorStoreId', async (req, res) => {
  try {
    const assistant = await openai.beta.assistants.update(
      req.params.assistantId,
      {
        tools: [{ type: "file_search" }],
        tool_resources: { 
          file_search: { 
            vector_store_ids: [req.params.vectorStoreId] 
          } 
        }
      }
    );
    res.json(assistant);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List files in vector store
app.get('/api/vectorstore/:vectorStoreId/files', async (req, res) => {
  try {
    const files = await openai.beta.vectorStores.files.list(
      req.params.vectorStoreId
    );
    res.json(files.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remove file from vector store
app.delete('/api/vectorstore/:vectorStoreId/files/:fileId', async (req, res) => {
  try {
    await openai.beta.vectorStores.files.del(
      req.params.vectorStoreId,
      req.params.fileId
    );
    res.json({ message: 'File removed from vector store successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create thread with file search message
app.post('/api/thread/with-file', upload.single('file'), async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!req.file || !message) {
      return res.status(400).json({ 
        error: 'Both file and message are required' 
      });
    }

    // 1. First upload the file to OpenAI
    const newPath = req.file.path + '-' + req.file.originalname;
    await fs.promises.rename(req.file.path, newPath);
    
    const uploadedFile = await openai.files.create({
      file: fs.createReadStream(newPath),
      purpose: 'assistants'
    });

    // Clean up the renamed file
    cleanupUploadedFile(newPath);

    // 2. Create thread with message and file attachment
    const thread = await openai.beta.threads.create({
      messages: [
        {
          role: "user",
          content: message,
          attachments: [
            { 
              file_id: uploadedFile.id, 
              tools: [{ type: "file_search" }] 
            }
          ]
        }
      ]
    });

    // 3. Get the file search tool resources
    const fileSearchResources = thread.tool_resources?.file_search;

    res.json({
      message: 'Thread created with file search capability',
      thread_id: thread.id,
      file_id: uploadedFile.id,
      file_search_resources: fileSearchResources
    });

  } catch (error) {
    // Cleanup files in case of error
    if (req.file) {
      cleanupUploadedFile(req.file.path);
      cleanupUploadedFile(req.file.path + '-' + req.file.originalname);
    }
    console.error('Error details:', error);
    res.status(500).json({ 
      error: error.message,
      type: error.type,
      code: error.code
    });
  }
});

// Add a message with file to existing thread
app.post('/api/thread/:threadId/message-with-file', upload.single('file'), async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!req.file || !message) {
      return res.status(400).json({ 
        error: 'Both file and message are required' 
      });
    }

    // 1. Upload file to OpenAI
    const newPath = req.file.path + '-' + req.file.originalname;
    await fs.promises.rename(req.file.path, newPath);
    
    const uploadedFile = await openai.files.create({
      file: fs.createReadStream(newPath),
      purpose: 'assistants'
    });

    // Clean up the renamed file
    cleanupUploadedFile(newPath);

    // 2. Create message with file attachment
    const threadMessage = await openai.beta.threads.messages.create(
      req.params.threadId,
      {
        role: "user",
        content: message,
        attachments: [
          { 
            file_id: uploadedFile.id, 
            tools: [{ type: "file_search" }] 
          }
        ]
      }
    );

    res.json({
      message: 'Message with file search added to thread',
      thread_id: req.params.threadId,
      message_id: threadMessage.id,
      file_id: uploadedFile.id
    });

  } catch (error) {
    // Cleanup files in case of error
    if (req.file) {
      cleanupUploadedFile(req.file.path);
      cleanupUploadedFile(req.file.path + '-' + req.file.originalname);
    }
    console.error('Error details:', error);
    res.status(500).json({ 
      error: error.message,
      type: error.type,
      code: error.code
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 