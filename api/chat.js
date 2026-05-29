export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { messages, systemPrompt } = req.body;

    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Invalid request body' });
    }

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt || '' },
                    ...messages,
                ],
                temperature: 0.7,
                max_tokens: 1500,
            }),
        });

        if (response.status === 429) {
            const retryAfter = response.headers.get('retry-after') || '30';
            return res.status(429).json({ error: 'rate_limit', retryAfter: parseInt(retryAfter, 10) || 30 });
        }

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            return res.status(response.status).json({ error: err.error?.message || `OpenAI error ${response.status}` });
        }

        const data = await response.json();
        return res.status(200).json({ reply: data.choices[0].message.content });

    } catch (err) {
        return res.status(500).json({ error: err.message || 'Internal server error' });
    }
}
