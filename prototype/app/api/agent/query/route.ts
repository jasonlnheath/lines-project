import { NextRequest, NextResponse } from 'next/server';
import { MultiModelOrchestrator } from '@/services/agent/multiModelOrchestrator';
import { AgentQuery } from '@/services/agent/types';
import { getPersonaFromRequest } from '@/services/agent/persona/personaStorage';

/**
 * Agent query API endpoint
 * Processes natural language queries using multi-model architecture
 */
export async function POST(request: NextRequest) {
  try {
    // Get refresh token from cookies
    const refreshData = request.cookies.get('refresh_data')?.value;

    if (!refreshData) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const data = JSON.parse(refreshData);
    const { refreshToken, expiresAt } = data;

    if (!refreshToken) {
      return NextResponse.json(
        { error: 'No refresh token available' },
        { status: 401 }
      );
    }

    // Check if token is expired (with 5 min buffer)
    const isExpired = Date.now() >= expiresAt - 300000;

    let accessToken: string;

    if (isExpired) {
      return NextResponse.json(
        { error: 'Token expired', refreshRequired: true },
        { status: 401 }
      );
    }

    // Get fresh access token by calling refresh endpoint
    const cookieHeader = request.headers.get('cookie');

    const refreshResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cookieHeader && { Cookie: cookieHeader }),
      },
    });

    if (!refreshResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to refresh access token' },
        { status: 401 }
      );
    }

    const refreshDataResult = await refreshResponse.json();

    if (refreshDataResult.error) {
      return NextResponse.json(
        { error: refreshDataResult.error },
        { status: 401 }
      );
    }

    accessToken = refreshDataResult.accessToken;

    // Parse request body
    const body = await request.json();
    const { query, conversationHistory, previousToolResults } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required and must be a string' },
        { status: 400 }
      );
    }

    // Get user info from cookies
    const userInfo = request.cookies.get('user_info')?.value;
    const user = userInfo ? JSON.parse(userInfo) : null;

    if (!user) {
      return NextResponse.json(
        { error: 'User information not found' },
        { status: 401 }
      );
    }

    // Get persona from cookies
    const persona = getPersonaFromRequest(request);

    // Create agent query with conversation context
    const agentQuery: AgentQuery = {
      query,
      userId: user.id,
      accessToken,
      conversationHistory,
      previousToolResults,
    };

    // Use multi-model orchestrator
    const orchestrator = new MultiModelOrchestrator({
      persona: persona || undefined,
      maxRounds: 3,
    });

    const response = await orchestrator.processQuery(agentQuery);

    return NextResponse.json({
      answer: response.answer,
      toolTrace: response.toolTrace,
      sources: response.sources,
      conversationHistory: response.conversationHistory,
      toolResults: response.toolResults,
    });
  } catch (error) {
    console.error('Error processing agent query:', error);
    return NextResponse.json(
      { error: 'Failed to process query' },
      { status: 500 }
    );
  }
}
