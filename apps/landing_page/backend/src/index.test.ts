import { vi, describe, it, expect, beforeEach } from 'vitest';

// Define hoisted mocks to prevent ReferenceError during module hoisting
const { mockCollection, mockDoc, mockSet } = vi.hoisted(() => {
  const mockSet = vi.fn().mockResolvedValue({});
  const mockDoc = vi.fn().mockReturnValue({
    id: 'mock-doc-id',
    set: mockSet,
  });
  const mockCollection = vi.fn().mockReturnValue({
    doc: mockDoc,
  });
  return { mockCollection, mockDoc, mockSet };
});

vi.mock('@google-cloud/firestore', () => {
  return {
    Firestore: class MockFirestore {
      collection = mockCollection;
    },
    FieldValue: {
      serverTimestamp: () => 'mock-server-timestamp',
    },
  };
});

import { submitInquiry } from './index';

describe('submitInquiry Google Cloud Function', () => {
  let mockRequest: any;
  let mockResponse: any;
  let responseData: any;
  let responseHeaders: Record<string, string>;
  let responseStatus: number;

  beforeEach(() => {
    vi.clearAllMocks();
    responseData = null;
    responseHeaders = {};
    responseStatus = 200;

    mockResponse = {
      set: vi.fn().mockImplementation((key, val) => {
        responseHeaders[key] = val;
      }),
      status: vi.fn().mockImplementation((code) => {
        responseStatus = code;
        return mockResponse;
      }),
      send: vi.fn().mockImplementation((data) => {
        responseData = data;
        return mockResponse;
      }),
      json: vi.fn().mockImplementation((data) => {
        responseData = data;
        return mockResponse;
      }),
    };
  });

  it('should handle OPTIONS preflight request', async () => {
    mockRequest = {
      method: 'OPTIONS',
    };

    await submitInquiry(mockRequest, mockResponse);

    expect(responseStatus).toBe(204);
    expect(responseHeaders['Access-Control-Allow-Origin']).toBe('*');
  });

  it('should reject GET requests with a 405 Method Not Allowed', async () => {
    mockRequest = {
      method: 'GET',
    };

    await submitInquiry(mockRequest, mockResponse);

    expect(responseStatus).toBe(405);
    expect(responseData.success).toBe(false);
  });

  it('should bypass Firestore and return success silently if honeypot is filled', async () => {
    mockRequest = {
      method: 'POST',
      body: {
        name: 'Vito Corleone',
        email: 'vito@corleone.com',
        subject: 'Inquiry',
        message: 'Message text',
        honeypot: 'i-am-a-bot-spammer',
      },
    };

    await submitInquiry(mockRequest, mockResponse);

    expect(responseStatus).toBe(201);
    expect(responseData.success).toBe(true);
    expect(responseData.id).toBe('bot-blocked-id');
    expect(mockDoc).not.toHaveBeenCalled();
  });

  it('should return 400 validation error if required fields are missing', async () => {
    mockRequest = {
      method: 'POST',
      body: {
        name: '',
        email: 'invalid-email',
        subject: '',
        message: '',
      },
    };

    await submitInquiry(mockRequest, mockResponse);

    expect(responseStatus).toBe(400);
    expect(responseData.success).toBe(false);
    expect(responseData.error).toBe('Validation failed');
    expect(responseData.details).toContain('Name is required');
    expect(responseData.details).toContain('Valid email is required');
    expect(responseData.details).toContain('Subject is required');
    expect(responseData.details).toContain('Message is required');
  });

  it('should return 201 Created and save to Firestore on valid input with default inquiryType', async () => {
    mockRequest = {
      method: 'POST',
      body: {
        name: 'Michael Corleone',
        email: 'michael@corleone.com',
        phone: '+525592449939',
        subject: 'Business Inquiry',
        message: 'Let us make a deal.',
      },
    };

    await submitInquiry(mockRequest, mockResponse);

    expect(responseStatus).toBe(201);
    expect(responseData.success).toBe(true);
    expect(responseData.id).toBe('mock-doc-id');
    expect(mockCollection).toHaveBeenCalledWith('contact_inquiries');
    expect(mockDoc).toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Michael Corleone',
        email: 'michael@corleone.com',
        phone: '+525592449939',
        subject: 'Business Inquiry',
        message: 'Let us make a deal.',
        inquiryType: 'general',
        status: 'pending',
        createdAt: 'mock-server-timestamp',
      })
    );
  });

  it('should return 201 Created and save specific inquiryType to Firestore', async () => {
    mockRequest = {
      method: 'POST',
      body: {
        name: 'Fredo Corleone',
        email: 'fredo@corleone.com',
        subject: 'Complaints',
        message: 'I was passed over!',
        inquiryType: 'quejas_sugerencias',
      },
    };

    await submitInquiry(mockRequest, mockResponse);

    expect(responseStatus).toBe(201);
    expect(responseData.success).toBe(true);
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Fredo Corleone',
        email: 'fredo@corleone.com',
        subject: 'Complaints',
        message: 'I was passed over!',
        inquiryType: 'quejas_sugerencias',
        status: 'pending',
      })
    );
  });
});
