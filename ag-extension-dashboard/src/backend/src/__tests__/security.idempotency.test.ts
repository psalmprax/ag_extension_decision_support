import { Request, Response, NextFunction } from 'express';
import { idempotencyMiddleware, clearIdempotencyStore } from '@/middleware/idempotencyMiddleware';

interface MockResponse extends Partial<Response> {
  body?: unknown;
  json: (body: unknown) => Response;
}

describe('Deep-Tier Network Reliability — Idempotency Key Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: MockResponse;
  let nextFunction: NextFunction;
  let originalJsonSpy: jest.Mock;

  beforeEach(() => {
    clearIdempotencyStore();
    originalJsonSpy = jest.fn().mockImplementation(function (body) {
      mockResponse.body = body;
      return mockResponse;
    });

    mockRequest = {
      method: 'POST',
      path: '/api/visits',
      headers: {
        'x-idempotency-key': 'visit_uuid_12345_unique',
      },
      body: { farmerId: 'farmer_001', notes: 'Checked maize crop for rust' },
    };
    mockResponse = {
      statusCode: 201,
      status: jest.fn().mockImplementation(function (code) {
        mockResponse.statusCode = code;
        return mockResponse;
      }),
      setHeader: jest.fn(),
      json: originalJsonSpy,
    };
    nextFunction = jest.fn();
  });

  it('should process first request and cache the 201 response', async () => {
    await idempotencyMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(nextFunction).toHaveBeenCalled();

    // Emulate route handler completing
    mockResponse.json!({ success: true, visitId: 'visit_999' });

    expect(originalJsonSpy).toHaveBeenCalledWith({ success: true, visitId: 'visit_999' });
    expect(mockResponse.body).toEqual({ success: true, visitId: 'visit_999' });
  });

  it('should replay cached response on duplicate retry without calling next() handler again', async () => {
    // 1st request
    await idempotencyMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);
    mockResponse.json!({ success: true, visitId: 'visit_999' });

    // 2nd request (spotty 2G retry with identical key)
    const secondReq = { ...mockRequest };
    const secondRes: MockResponse = {
      statusCode: 200,
      status: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
      json: jest.fn().mockReturnThis(),
    };
    const secondNext = jest.fn();

    await idempotencyMiddleware(secondReq as Request, secondRes as Response, secondNext);

    // Should NOT call handler a second time!
    expect(secondNext).not.toHaveBeenCalled();
    expect(secondRes.setHeader).toHaveBeenCalledWith('X-Cache-Lookup', 'HIT-IDEMPOTENT');
    expect(secondRes.status).toHaveBeenCalledWith(201);
    expect(secondRes.json).toHaveBeenCalledWith({ success: true, visitId: 'visit_999' });
  });
});
