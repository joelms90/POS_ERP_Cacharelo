export interface Employee {
  id: string;
  name: string;
  pin: string;
  role: 'waiter' | 'cashier' | 'kitchen';
}

export interface SystemHealth {
  apiOnline: boolean;
  databaseConnected: boolean;
  databaseType: 'PostgreSQL' | 'Local JSON File';
  activeSessionsCount: number;
}

export interface Category {
  id: string;
  businessId: string;
  name: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Product {
  id: string;
  businessId: string;
  categoryId: string;
  providerId?: string;
  name: string;
  sku?: string;
  barcode?: string;
  cost?: string;
  price?: string;
  isSellable?: boolean;
  isIngredient?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Provider {
  id: string;
  businessId: string;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  createdAt?: string;
  updatedAt?: string;
}

const DEFAULT_API_URL = 'http://localhost:3000/api';

// Retrieve the base URL from env or fallback
export const getApiBaseUrl = (): string => {
  return (import.meta.env.VITE_API_URL as string) || DEFAULT_API_URL;
};

// Key used to store the admin token in localStorage
const TOKEN_KEY = 'X-Admin-Token';

export const getAdminToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

export const setAdminToken = (token: string): void => {
  localStorage.setItem(TOKEN_KEY, token);
};

export const clearAdminToken = (): void => {
  localStorage.removeItem(TOKEN_KEY);
};

/**
 * Generic fetch wrapper that appends the X-Admin-Token header
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const token = getAdminToken();
  
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('X-Admin-Token', token);
  }

  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMessage = `API Error: ${response.status} ${response.statusText}`;
    try {
      const errorJson = await response.json();
      errorMessage = errorJson.error || errorJson.message || errorMessage;
    } catch {
      // ignore JSON parse error
    }
    throw new Error(errorMessage);
  }

  return response.json() as Promise<T>;
}

/**
 * API service endpoints
 */
export const api = {
  /**
   * Verify the admin password and store token
   */
  async verifyAdminPassword(password: string): Promise<{ success: boolean; token: string }> {
    const data = await apiRequest<{ success: boolean; token: string }>('/auth/admin', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
    
    if (data.success && data.token) {
      setAdminToken(data.token);
    }
    return data;
  },

  /**
   * Get all registered users
   */
  async getUsers(): Promise<Employee[]> {
    return apiRequest<Employee[]>('/users');
  },

  /**
   * Create a new user profile
   */
  async addUser(employee: Omit<Employee, 'id'>): Promise<{ success: boolean; user: Employee }> {
    const response = await apiRequest<Employee | Employee[]>('/users', {
      method: 'POST',
      body: JSON.stringify(employee),
    });
    
    const user = Array.isArray(response) ? response[0] : response;
    return { success: true, user };
  },

  /**
   * Delete user profile (revoke access)
   */
  async deleteUser(id: string): Promise<{ success: boolean; message: string }> {
    return apiRequest<{ success: boolean; message: string }>(`/users/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * Get all categories for a business
   */
  async getCategories(businessId: string): Promise<Category[]> {
    return apiRequest<Category[]>(`/categories?businessId=${businessId}`);
  },

  /**
   * Add a new category for a business
   */
  async addCategory(category: Omit<Category, 'id' | 'businessId'>, businessId: string): Promise<Category> {
    return apiRequest<Category>('/categories', {
      method: 'POST',
      body: JSON.stringify({
        ...category,
        businessId,
      }),
    });
  },

  /**
   * Delete a category
   */
  async deleteCategory(id: string): Promise<{ success: boolean; message: string }> {
    return apiRequest<{ success: boolean; message: string }>(`/categories/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * Get all products for a business
   */
  async getProducts(businessId: string): Promise<Product[]> {
    return apiRequest<Product[]>(`/products?businessId=${businessId}`);
  },

  /**
   * Add a new product for a business
   */
  async addProduct(product: Omit<Product, 'id' | 'businessId'>, businessId: string): Promise<Product> {
    return apiRequest<Product>('/products', {
      method: 'POST',
      body: JSON.stringify({
        ...product,
        businessId,
      }),
    });
  },

  /**
   * Update a product
   */
  async updateProduct(id: string, productUpdates: Partial<Omit<Product, 'id' | 'businessId'>>): Promise<Product> {
    return apiRequest<Product>(`/products/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(productUpdates),
    });
  },

  /**
   * Delete a product
   */
  async deleteProduct(id: string): Promise<{ success: boolean; message: string }> {
    return apiRequest<{ success: boolean; message: string }>(`/products/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * Get all providers for a business
   */
  async getProviders(businessId: string): Promise<Provider[]> {
    return apiRequest<Provider[]>(`/providers?businessId=${businessId}`);
  },

  /**
   * Add a new provider for a business
   */
  async addProvider(provider: Omit<Provider, 'id' | 'businessId'>, businessId: string): Promise<Provider> {
    return apiRequest<Provider>('/providers', {
      method: 'POST',
      body: JSON.stringify({
        ...provider,
        businessId,
      }),
    });
  },

  /**
   * Update a provider
   */
  async updateProvider(id: string, providerUpdates: Partial<Omit<Provider, 'id' | 'businessId'>>): Promise<Provider> {
    return apiRequest<Provider>(`/providers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(providerUpdates),
    });
  },

  /**
   * Delete a provider
   */
  async deleteProvider(id: string): Promise<{ success: boolean; message: string }> {
    return apiRequest<{ success: boolean; message: string }>(`/providers/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * Check connection status of backend API and DB
   */
  async checkSystemHealth(): Promise<SystemHealth> {
    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetch(`${baseUrl}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Health check responded with non-200');
      }

      const healthData = await response.json();
      return {
        apiOnline: true,
        databaseConnected: healthData.database === 'connected',
        databaseType: 'PostgreSQL',
        activeSessionsCount: 0, // Default or mock count
      };
    } catch (error) {
      return {
        apiOnline: false,
        databaseConnected: false,
        databaseType: 'PostgreSQL',
        activeSessionsCount: 0,
      };
    }
  },
};
