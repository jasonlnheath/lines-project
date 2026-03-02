import { NextRequest, NextResponse } from 'next/server';
import { createAgentService } from '@/services/agent/agent';
import { AgentQuery } from '@/services/agent/types';

/**
 * Agent query API endpoint
 * Processes natural language queries and returns results
 */
export async function POST(request: NextRequest) {
  try {
    // Get auth token from cookies
    const tokens = request.cookies.get('auth_tokens')?.value;

    if (!tokens) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const tokenData = JSON.parse(tokens);

    // Check if token is expired
    if (Date.now() >= tokenData.expiresAt - 300000) {
      return NextResponse.json(
        { error: 'Token expired', refreshRequired: true },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { query } = body;

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

    // Create agent query
    const agentQuery: AgentQuery = {
      query,
      userId: user.id,
      accessToken: tokenData.accessToken,
    };

    // Process query
    const agent = createAgentService();
    const response = await agent.processQuery(agentQuery);

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error processing agent query:', error);
    return NextResponse.json(
      { error: 'Failed to process query' },
      { status: 500 }
    );
  }
}
