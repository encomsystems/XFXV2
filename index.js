
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
        
        // LOG START WORKFLOW RESPONSE
        console.log('=================================');
        console.log('🚀 N8N START WORKFLOW RESPONSE');
        console.log('=================================');
        console.log('📍 Webhook URL:', n8nWebhookUrl);
        console.log('📊 Response Status:', response.status);
        console.log('📋 Response Headers:', JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2));
        
        const responseText = await response.text();
        console.log('📄 Raw Response:', responseText);
        
        try {
            const data = JSON.parse(responseText);
            console.log('✅ PARSED START WORKFLOW RESPONSE:');
            console.log(JSON.stringify(data, null, 2));
            res.json(data);
        } catch (parseError) {
            console.log('❌ Failed to parse start workflow JSON:', parseError.message);
            res.json({ success: false, error: 'Invalid JSON response from n8n', raw: responseText });
        }
        console.log('=================================');
        
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
    
    console.log('=================================');
    console.log('📤 SENDING REQUEST TO N8N');
    console.log('=================================');
    console.log('📍 Resume URL:', resumeUrl);
    console.log('📋 Request Headers:', JSON.stringify({
        'Content-Type': req.headers['content-type'],
        'Content-Length': req.headers['content-length'],
        'User-Agent': req.headers['user-agent']
    }, null, 2));
    
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
        
        // LOG ALL N8N RESPONSES
        console.log('=================================');
        console.log('📨 N8N RESPONSE RECEIVED');
        console.log('=================================');
        console.log('📍 Response URL:', resumeUrl);
        console.log('📊 Response Status:', response.status);
        console.log('📋 Response Headers:', JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2));
        console.log('📄 Raw Response Body:', responseText);
        console.log('📏 Response Length:', responseText.length);
        console.log('=================================');
        
        if (!responseText.trim()) {
            // Empty response - treat as success
            console.log('⚠️  Empty response from n8n, treating as success');
            res.json({ success: true, message: 'File uploaded successfully' });
            return;
        }
        
        try {
            const data = JSON.parse(responseText);
            console.log('✅ N8N PARSED JSON RESPONSE:');
            console.log(JSON.stringify(data, null, 2));
            
            // Check if the response is an array containing XFX API response data
            if (Array.isArray(data) && data.length > 0 && data[0].xfxTrackingId) {
                console.log('🎯 XFX API RESPONSE DETECTED (ARRAY FORMAT):');
                console.log(JSON.stringify(data[0], null, 2));
                res.json({
                    success: true,
                    message: 'Invoice processed',
                    response: data[0]  // Extract first item from array
                });
            } else if (data.response) {
                console.log('🎯 XFX API RESPONSE DETECTED (OBJECT FORMAT):');
                console.log(JSON.stringify(data.response, null, 2));
                res.json({
                    success: true,
                    message: 'Invoice processed',
                    response: data.response
                });
            } else {
                console.log('📤 Sending parsed data to frontend');
                res.json({
                    success: true,
                    data: data
                });
            }
        } catch (parseError) {
                console.log('❌ Failed to parse JSON response:', parseError.message);
                console.log('📝 Returning raw text response');
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
