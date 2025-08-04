
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
app.post('/api/resume-workflow', async (req, res) => {
    const resumeUrl = req.query.resumeUrl;
    
    if (!resumeUrl) {
        return res.status(400).json({
            success: false,
            error: 'Resume URL is required'
        });
    }
    
    try {
        console.log('Resuming workflow at:', resumeUrl);
        
        // Stream request body directly to n8n with duplex option
        const response = await fetch(resumeUrl, {
            method: 'POST',
            body: req,           // Pass entire request object - NO FILE STORAGE
            duplex: 'half',      // Required for Node.js streaming
            headers: {
                'Content-Type': req.headers['content-type'],
                'Content-Length': req.headers['content-length']
            }
        });
        
        const data = await response.json();
        res.json(data);
        
    } catch (error) {
        console.error('Error resuming workflow:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to resume workflow'
        });
    }
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
