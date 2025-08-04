
const express = require('express');
const app = express();
const port = 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// API endpoint to start workflow (proxy to n8n)
app.post('/api/start-workflow', async (req, res) => {
    console.log('Starting workflow...');
    
    try {
        // This would be your actual n8n webhook URL
        const n8nWebhookUrl = 'http://localhost:5678/webhook-test/invoice-postman';
        
        // Make actual request to n8n webhook
        const response = await fetch(n8nWebhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(req.body)
        });
        
        const data = await response.json();
        res.json(data);
        
    } catch (error) {
        console.error('Error starting workflow:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to start workflow'
        });
    }
});

// API endpoint to resume workflow (proxy to n8n resume URL)
app.post('/api/resume-workflow', (req, res) => {
    const resumeUrl = req.query.resumeUrl;
    
    if (!resumeUrl) {
        return res.status(400).json({
            success: false,
            error: 'Resume URL is required'
        });
    }
    
    console.log('Resuming workflow at:', resumeUrl);
    console.log('Content-Type:', req.headers['content-type']);
    
    // Create headers object
    const headers = {};
    if (req.headers['content-type']) {
        headers['Content-Type'] = req.headers['content-type'];
    }
    if (req.headers['content-length']) {
        headers['Content-Length'] = req.headers['content-length'];
    }
    
    // Collect body data manually
    const chunks = [];
    req.on('data', chunk => {
        chunks.push(chunk);
    });
    
    req.on('end', async () => {
        try {
            const body = Buffer.concat(chunks);
            
            // Stream body directly to n8n
            const response = await fetch(resumeUrl, {
                method: 'POST',
                body: body,
                headers: headers
            });
        
        console.log('n8n response status:', response.status);
        console.log('n8n response headers:', Object.fromEntries(response.headers.entries()));
        
        if (!response.ok) {
            const errorText = await response.text();
            console.log('n8n error response:', errorText);
            throw new Error(`n8n responded with status: ${response.status} - ${errorText}`);
        }
        
        // Get response as text first to check if it's valid JSON
        const responseText = await response.text();
        console.log('n8n raw response:', responseText);
        
        if (!responseText.trim()) {
            // Empty response - treat as success
            console.log('Empty response from n8n, treating as success');
            res.json({ success: true, message: 'File uploaded successfully' });
            return;
        }
        
        try {
            const data = JSON.parse(responseText);
            console.log('n8n parsed response:', data);
            res.json(data);
        } catch (parseError) {
                console.log('Failed to parse JSON, returning text response');
                // If it's not JSON, return the text as a message
                res.json({ success: true, message: responseText, raw: true });
            }
            
        } catch (error) {
            console.error('Error resuming workflow:', error.message);
            res.status(500).json({
                success: false,
                error: `Failed to resume workflow: ${error.message}`
            });
        }
    });
    
    req.on('error', (error) => {
        console.error('Request stream error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to read request body'
        });
    });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 XFX Invoice System running at http://localhost:${port}`);
    console.log(`📁 Serving static files from /public`);
    console.log(`🔗 API endpoints available at /api/*`);
});
