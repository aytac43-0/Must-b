import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import { getAIResponseStructured, toUserFacingMessage } from '@/lib/ai'

export async function POST(req: Request) {
    const supabase = createClient()
    const { chat_id, message } = await req.json()

    // 1. Get user session
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Simple Rate Limiting (10 msgs / min)
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
    const { count, error: countError } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', oneMinuteAgo);

    if (!countError && count && count >= 10) {
        return NextResponse.json({
            role: 'assistant',
            content: "You've reached the message limit (10 per minute). Please wait a moment before sending more."
        }, { status: 429 });
    }

    // 3. Save user message
    const { error: userMsgError } = await supabase
        .from('messages')
        .insert([
            {
                chat_id,
                role: 'user',
                content: message,
                user_id: user.id,
            },
        ])

    if (userMsgError) {
        console.error("Supabase User Msg Insert Error:", userMsgError);
        return NextResponse.json({ error: userMsgError.message }, { status: 500 })
    }

    // 4. Get Response via Adapter Layer
    const aiResult = await getAIResponseStructured(message);
    const assistantResponse = aiResult.ok
        ? aiResult.text
        : toUserFacingMessage(aiResult.error);

    if (!aiResult.ok) {
        console.warn('AI provider degraded response', {
            provider: aiResult.provider,
            code: aiResult.error.code,
            status: aiResult.error.status,
        });
    }

    // 5. Save assistant message
    const { error: assistantMsgError } = await supabase
        .from('messages')
        .insert([
            {
                chat_id,
                role: 'assistant',
                content: assistantResponse,
                user_id: user.id,
            },
        ])

    if (assistantMsgError) {
        console.error("Supabase Assistant Msg Insert Error:", assistantMsgError);
        return NextResponse.json({ error: assistantMsgError.message }, { status: 500 })
    }

    return NextResponse.json({ role: 'assistant', content: assistantResponse })
}
