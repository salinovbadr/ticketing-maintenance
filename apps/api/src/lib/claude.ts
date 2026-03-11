import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export type ClassificationResult = {
    isReport: boolean;
    subject?: string;
    category?: 'login_issue' | 'system_down' | 'bug' | 'performance' | 'data_issue' | 'feature_request' | 'other';
    priority?: 'critical' | 'high' | 'medium' | 'low';
};

export async function classifyMessage(text: string): Promise<ClassificationResult> {
    if (!process.env.ANTHROPIC_API_KEY) {
        return { isReport: false };
    }

    const prompt = `Analisis pesan WhatsApp berikut. Tentukan apakah ini laporan masalah/bug/error atau chat biasa. 
Jika laporan, extract: subject (ringkasan singkat), category (pilih salah satu: login_issue, system_down, bug, performance, data_issue, feature_request, other), priority (pilih salah satu: critical, high, medium, low). 
Respond hanya dalam format JSON. 

Format JSON:
{
  "isReport": boolean,
  "subject": "string",
  "category": "string",
  "priority": "string"
}

Pesan: "${text}"`;

    try {
        const response = await anthropic.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 1024,
            messages: [{ role: 'user', content: prompt }],
        });

        const content = response.content[0].type === 'text' ? response.content[0].text : '';
        if (!content) return { isReport: false };

        // Extract JSON (Claude might wrap it in markdown)
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return {
                isReport: !!parsed.isReport,
                subject: parsed.subject,
                category: parsed.category,
                priority: parsed.priority,
            };
        }
    } catch (error) {
        console.error('Claude classification error:', error);
    }

    return { isReport: false };
}
