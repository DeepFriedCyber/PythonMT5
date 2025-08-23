import { renderHook, act } from '@testing-library/react';
import { useStrategies, useFormValidation, useAuth, useDebounce, useLocalStorage } from '../index';
import { apiService } from '../../services/api';

// Mock the API service
jest.mock('../../services/api');
const mockApiService = apiService as jest.Mocked<typeof apiService>;

describe('Custom Hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('useStrategies', () => {
    it('should fetch strategies on mount', async () => {
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
      mockApiService.getStrategies.mockResolvedValue(mockStrategies);

      // Act
      const { result } = renderHook(() => useStrategies());

      // Assert
      expect(result.current.loading).toBe(true);
      
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.strategies).toEqual(mockStrategies);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(null);
    });

    it('should handle fetch error', async () => {
      // Arrange
      mockApiService.getStrategies.mockRejectedValue(new Error('API Error'));

      // Act
      const { result } = renderHook(() => useStrategies());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Assert
      expect(result.current.strategies).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe('Failed to fetch strategies');
    });

    it('should create strategy successfully', async () => {
      // Arrange
      const existingStrategies = [
        {
          id: '1',
          name: 'Existing Strategy',
          description: 'Existing',
          code: 'existing code',
          version: '1.0.0',
          createdAt: '2023-01-01T00:00:00Z'
        }
      ];
      const newStrategy = {
        id: '2',
        name: 'New Strategy',
        description: 'New',
        code: 'new code',
        version: '1.0.0',
        createdAt: '2023-01-02T00:00:00Z'
      };

      mockApiService.getStrategies.mockResolvedValue(existingStrategies);
      mockApiService.createStrategy.mockResolvedValue(newStrategy);

      const { result } = renderHook(() => useStrategies());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Act
      await act(async () => {
        await result.current.createStrategy({
          name: 'New Strategy',
          description: 'New',
          code: 'new code',
          version: '1.0.0'
        });
      });

      // Assert
      expect(result.current.strategies).toHaveLength(2);
      expect(result.current.strategies[1]).toEqual(newStrategy);
    });

    it('should delete strategy successfully', async () => {
      // Arrange
      const strategies = [
        {
          id: '1',
          name: 'Strategy 1',
          description: 'Test 1',
          code: 'code 1',
          version: '1.0.0',
          createdAt: '2023-01-01T00:00:00Z'
        },
        {
          id: '2',
          name: 'Strategy 2',
          description: 'Test 2',
          code: 'code 2',
          version: '1.0.0',
          createdAt: '2023-01-02T00:00:00Z'
        }
      ];

      mockApiService.getStrategies.mockResolvedValue(strategies);
      mockApiService.deleteStrategy.mockResolvedValue(undefined);

      const { result } = renderHook(() => useStrategies());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Act
      await act(async () => {
        await result.current.deleteStrategy('1');
      });

      // Assert
      expect(result.current.strategies).toHaveLength(1);
      expect(result.current.strategies[0].id).toBe('2');
    });
  });

  describe('useFormValidation', () => {
    const validationRules = {
      name: (value: string) => !value ? 'Name is required' : null,
      email: (value: string) => {
        if (!value) return 'Email is required';
        if (!/\S+@\S+\.\S+/.test(value)) return 'Email is invalid';
        return null;
      },
    };

    it('should initialize with default values', () => {
      // Arrange
      const initialValues = { name: '', email: '' };

      // Act
      const { result } = renderHook(() => 
        useFormValidation(initialValues, validationRules)
      );

      // Assert
      expect(result.current.values).toEqual(initialValues);
      expect(result.current.errors).toEqual({});
      expect(result.current.touched).toEqual({});
      expect(result.current.isValid).toBe(false);
    });

    it('should update values and validate', () => {
      // Arrange
      const initialValues = { name: '', email: '' };
      const { result } = renderHook(() => 
        useFormValidation(initialValues, validationRules)
      );

      // Act
      act(() => {
        result.current.setValue('name', 'John Doe');
        result.current.setTouched('name');
      });

      // Assert
      expect(result.current.values.name).toBe('John Doe');
      expect(result.current.touched.name).toBe(true);
      expect(result.current.errors.name).toBeUndefined();
    });

    it('should show validation errors for invalid values', () => {
      // Arrange
      const initialValues = { name: '', email: '' };
      const { result } = renderHook(() => 
        useFormValidation(initialValues, validationRules)
      );

      // Act
      act(() => {
        result.current.setValue('email', 'invalid-email');
        result.current.setTouched('email');
      });

      // Assert
      expect(result.current.errors.email).toBe('Email is invalid');
      expect(result.current.isValid).toBe(false);
    });

    it('should validate all fields', () => {
      // Arrange
      const initialValues = { name: 'John', email: 'john@example.com' };
      const { result } = renderHook(() => 
        useFormValidation(initialValues, validationRules)
      );

      // Act
      let isValid: boolean;
      act(() => {
        isValid = result.current.validateAll();
      });

      // Assert
      expect(isValid!).toBe(true);
      expect(result.current.isValid).toBe(true);
    });

    it('should reset form', () => {
      // Arrange
      const initialValues = { name: '', email: '' };
      const { result } = renderHook(() => 
        useFormValidation(initialValues, validationRules)
      );

      act(() => {
        result.current.setValue('name', 'John');
        result.current.setTouched('name');
      });

      // Act
      act(() => {
        result.current.reset();
      });

      // Assert
      expect(result.current.values).toEqual(initialValues);
      expect(result.current.errors).toEqual({});
      expect(result.current.touched).toEqual({});
    });
  });

  describe('useAuth', () => {
    it('should initialize authentication state from localStorage', () => {
      // Arrange
      const mockGetItem = jest.fn().mockReturnValue('test-token');
      Object.defineProperty(window, 'localStorage', {
        value: { getItem: mockGetItem },
        writable: true,
      });

      // Act
      const { result } = renderHook(() => useAuth());

      // Assert
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.loading).toBe(false);
    });

    it('should login successfully', async () => {
      // Arrange
      mockApiService.login.mockResolvedValue({
        access_token: 'new-token',
        token_type: 'bearer'
      });

      const mockSetItem = jest.fn();
      Object.defineProperty(window, 'localStorage', {
        value: { 
          getItem: jest.fn().mockReturnValue(null),
          setItem: mockSetItem 
        },
        writable: true,
      });

      const { result } = renderHook(() => useAuth());

      // Act
      await act(async () => {
        await result.current.login('admin', 'password');
      });

      // Assert
      expect(result.current.isAuthenticated).toBe(true);
      expect(mockSetItem).toHaveBeenCalledWith('access_token', 'new-token');
    });

    it('should logout successfully', () => {
      // Arrange
      const mockRemoveItem = jest.fn();
      Object.defineProperty(window, 'localStorage', {
        value: { 
          getItem: jest.fn().mockReturnValue('test-token'),
          removeItem: mockRemoveItem 
        },
        writable: true,
      });

      const { result } = renderHook(() => useAuth());

      // Act
      act(() => {
        result.current.logout();
      });

      // Assert
      expect(result.current.isAuthenticated).toBe(false);
      expect(mockRemoveItem).toHaveBeenCalledWith('access_token');
    });
  });

  describe('useDebounce', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should debounce value changes', () => {
      // Arrange
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: 'initial', delay: 500 } }
      );

      // Assert initial value
      expect(result.current).toBe('initial');

      // Act - change value
      rerender({ value: 'updated', delay: 500 });

      // Assert - value should not change immediately
      expect(result.current).toBe('initial');

      // Act - advance timers
      act(() => {
        jest.advanceTimersByTime(500);
      });

      // Assert - value should be updated after delay
      expect(result.current).toBe('updated');
    });

    it('should cancel previous timeout on rapid changes', () => {
      // Arrange
      const { result, rerender } = renderHook(
        ({ value, delay }) => useDebounce(value, delay),
        { initialProps: { value: 'initial', delay: 500 } }
      );

      // Act - rapid changes
      rerender({ value: 'change1', delay: 500 });
      act(() => {
        jest.advanceTimersByTime(250);
      });
      
      rerender({ value: 'change2', delay: 500 });
      act(() => {
        jest.advanceTimersByTime(250);
      });

      // Assert - should still be initial value
      expect(result.current).toBe('initial');

      // Act - complete the timeout
      act(() => {
        jest.advanceTimersByTime(250);
      });

      // Assert - should be the latest value
      expect(result.current).toBe('change2');
    });
  });

  describe('useLocalStorage', () => {
    it('should initialize with value from localStorage', () => {
      // Arrange
      const mockGetItem = jest.fn().mockReturnValue(JSON.stringify('stored-value'));
      Object.defineProperty(window, 'localStorage', {
        value: { getItem: mockGetItem },
        writable: true,
      });

      // Act
      const { result } = renderHook(() => useLocalStorage('test-key', 'default-value'));

      // Assert
      expect(result.current[0]).toBe('stored-value');
    });

    it('should use default value when localStorage is empty', () => {
      // Arrange
      const mockGetItem = jest.fn().mockReturnValue(null);
      Object.defineProperty(window, 'localStorage', {
        value: { getItem: mockGetItem },
        writable: true,
      });

      // Act
      const { result } = renderHook(() => useLocalStorage('test-key', 'default-value'));

      // Assert
      expect(result.current[0]).toBe('default-value');
    });

    it('should update localStorage when value changes', () => {
      // Arrange
      const mockSetItem = jest.fn();
      Object.defineProperty(window, 'localStorage', {
        value: { 
          getItem: jest.fn().mockReturnValue(null),
          setItem: mockSetItem 
        },
        writable: true,
      });

      const { result } = renderHook(() => useLocalStorage('test-key', 'default-value'));

      // Act
      act(() => {
        result.current[1]('new-value');
      });

      // Assert
      expect(result.current[0]).toBe('new-value');
      expect(mockSetItem).toHaveBeenCalledWith(
        'test-key',
        JSON.stringify('new-value')
      );
    });

    it('should remove value from localStorage', () => {
      // Arrange
      const mockRemoveItem = jest.fn();
      Object.defineProperty(window, 'localStorage', {
        value: { 
          getItem: jest.fn().mockReturnValue(JSON.stringify('stored-value')),
          removeItem: mockRemoveItem 
        },
        writable: true,
      });

      const { result } = renderHook(() => useLocalStorage('test-key', 'default-value'));

      // Act
      act(() => {
        result.current[2](); // removeValue
      });

      // Assert
      expect(result.current[0]).toBe('default-value');
      expect(mockRemoveItem).toHaveBeenCalledWith('test-key');
    });
  });
});