import { ApiService, ApiError } from '../api';

// Mock fetch globally
global.fetch = jest.fn();

describe('ApiService', () => {
  let apiService: ApiService;
  const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    apiService = new ApiService('http://test-api.com');
    jest.clearAllMocks();
    
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
      },
      writable: true,
    });
  });

  describe('Authentication', () => {
    it('should login successfully with valid credentials', async () => {
      // Arrange
      const mockResponse = {
        access_token: 'test-token',
        token_type: 'bearer'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      // Act
      const result = await apiService.login('admin', 'password');

      // Assert
      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.com/token',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
          body: 'username=admin&password=password',
        })
      );
    });

    it('should throw ApiError on login failure', async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({
          error: { message: 'Invalid credentials', code: 'AUTH_FAILED' }
        }),
      } as Response);

      // Act & Assert
      await expect(apiService.login('admin', 'wrong-password'))
        .rejects.toThrow(ApiError);
      
      try {
        await apiService.login('admin', 'wrong-password');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        if (error instanceof ApiError) {
          expect(error.message).toBe('Invalid credentials');
          expect(error.status).toBe(401);
          expect(error.code).toBe('AUTH_FAILED');
        }
      }
    });
  });

  describe('Strategy Management', () => {
    beforeEach(() => {
      (window.localStorage.getItem as jest.Mock).mockReturnValue('test-token');
    });

    it('should fetch strategies successfully', async () => {
      // Arrange
      const mockStrategies = [
        {
          id: '1',
          name: 'Test Strategy',
          description: 'Test',
          code: 'test code',
          version: '1.0.0',
          createdAt: '2023-01-01T00:00:00Z'
        }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: mockStrategies }),
      } as Response);

      // Act
      const result = await apiService.getStrategies();

      // Assert
      expect(result).toEqual(mockStrategies);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.com/strategies',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token',
          }),
        })
      );
    });

    it('should create strategy successfully', async () => {
      // Arrange
      const newStrategy = {
        name: 'New Strategy',
        description: 'New strategy description',
        code: 'strategy code',
        version: '1.0.0'
      };

      const createdStrategy = {
        id: '2',
        ...newStrategy,
        createdAt: '2023-01-01T00:00:00Z'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: createdStrategy }),
      } as Response);

      // Act
      const result = await apiService.createStrategy(newStrategy);

      // Assert
      expect(result).toEqual(createdStrategy);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.com/strategies',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token',
          }),
          body: JSON.stringify(newStrategy),
        })
      );
    });

    it('should delete strategy successfully', async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      // Act
      await apiService.deleteStrategy('1');

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.com/strategies/1',
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token',
          }),
        })
      );
    });

    it('should handle API errors gracefully', async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({
          success: false,
          error: { message: 'Strategy not found', code: 'NOT_FOUND' }
        }),
      } as Response);

      // Act & Assert
      await expect(apiService.getStrategy('999'))
        .rejects.toThrow(ApiError);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      // Arrange
      mockFetch.mockRejectedValueOnce(new Error('Network failure'));

      // Act & Assert
      await expect(apiService.getStrategies())
        .rejects.toThrow('Network error: Network failure');
    });

    it('should handle malformed JSON responses', async () => {
      // Arrange
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => { throw new Error('Invalid JSON'); },
      } as Response);

      // Act & Assert
      await expect(apiService.getStrategies())
        .rejects.toThrow('HTTP 500: Internal Server Error');
    });

    it('should handle responses without authentication token', async () => {
      // Arrange
      (window.localStorage.getItem as jest.Mock).mockReturnValue(null);
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [] }),
      } as Response);

      // Act
      await apiService.getStrategies();

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.com/strategies',
        expect.objectContaining({
          headers: expect.not.objectContaining({
            'Authorization': expect.any(String),
          }),
        })
      );
    });
  });

  describe('File Upload', () => {
    beforeEach(() => {
      (window.localStorage.getItem as jest.Mock).mockReturnValue('test-token');
    });

    it('should upload file successfully', async () => {
      // Arrange
      const mockFile = new File(['test content'], 'test.csv', { type: 'text/csv' });
      const mockResponse = {
        filename: 'test.csv',
        columns: ['open', 'high', 'low', 'close'],
        row_count: 100
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      // Act
      const result = await apiService.uploadData(mockFile);

      // Assert
      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.com/upload-data',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token',
          }),
          body: expect.any(FormData),
        })
      );
    });
  });

  describe('Backtesting', () => {
    beforeEach(() => {
      (window.localStorage.getItem as jest.Mock).mockReturnValue('test-token');
    });

    it('should run backtest successfully', async () => {
      // Arrange
      const mockResult = {
        initial_capital: 10000,
        final_portfolio_value: 12000,
        total_profit: 2000,
        profit_percentage: 20
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResult,
      } as Response);

      // Act
      const result = await apiService.runBacktest('strategy-1', 'dataset.csv');

      // Assert
      expect(result).toEqual(mockResult);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.com/run-backtest',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            strategy_id: 'strategy-1',
            dataset_name: 'dataset.csv'
          }),
        })
      );
    });
  });
});