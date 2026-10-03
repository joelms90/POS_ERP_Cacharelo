import jwt from 'jsonwebtoken';
import { config } from './config.js';

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: any;
  query?: Record<string, string | number | boolean | undefined>;
}

export class PosApiClient {
  private baseUrl: string;
  private token: string;
  private jwtToken: string;

  constructor(
    baseUrl = config.apiUrl,
    token = config.adminToken,
    jwtSecret = config.jwtSecret,
    businessId = config.defaultBusinessId,
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.token = token;

    // Generate valid admin JWT token
    this.jwtToken = jwt.sign(
      {
        sub: 'mcp-server-admin',
        name: 'MCP Server Admin',
        role: 'owner',
        roles: ['owner', 'inventory_admin', 'support_tech'],
        businessId,
        businessAccess: [{ businessId, role: 'owner' }],
      },
      jwtSecret,
      { expiresIn: '365d' },
    );
  }

  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, query } = options;

    let url = `${this.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

    if (query) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      }
      const qs = params.toString();
      if (qs) {
        url += (url.includes('?') ? '&' : '?') + qs;
      }
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Admin-Token': this.token,
      'Authorization': `Bearer ${this.jwtToken}`,
    };

    const fetchOptions: RequestInit = {
      method,
      headers,
    };

    if (body && method !== 'GET') {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      let errorDetail = `${response.status} ${response.statusText}`;
      try {
        const errJson = await response.json();
        errorDetail = errJson.message || errJson.error || JSON.stringify(errJson);
      } catch {
        // Fallback to text
        try {
          errorDetail = await response.text();
        } catch {
          // ignore
        }
      }
      throw new Error(`API Error [${method} ${endpoint}]: ${errorDetail}`);
    }

    return response.json() as Promise<T>;
  }

  // Convenience Methods
  async getHealth() {
    return this.request<{ status: string; database?: string }>('/health');
  }

  // Catalog
  async getProducts(businessId: string, query?: { search?: string; categoryId?: string; isSellable?: boolean }) {
    return this.request<any[]>('/products', {
      query: { businessId, ...query },
    });
  }

  async getProductById(id: string) {
    return this.request<any>(`/products/${id}`);
  }

  async updateProduct(id: string, updates: Record<string, any>) {
    return this.request<any>(`/products/${id}`, {
      method: 'PATCH',
      body: updates,
    });
  }

  async getCategories(businessId: string) {
    return this.request<any[]>('/categories', {
      query: { businessId },
    });
  }

  // Branches & Tables
  async getBranches(businessId: string) {
    return this.request<any[]>('/branches', {
      query: { businessId },
    });
  }

  async getTables(branchId: string) {
    return this.request<any[]>(`/branches/${branchId}/tables`);
  }

  async updateTable(branchId: string, tableId: string, updates: { state?: string; label?: string }) {
    return this.request<any>(`/branches/${branchId}/tables/${tableId}`, {
      method: 'PATCH',
      body: updates,
    });
  }

  // POS & Kitchen
  async getActiveOrders(branchId: string) {
    return this.request<any[]>('/orders/active', {
      query: { branchId },
    });
  }

  async getKitchenTickets(branchId: string) {
    return this.request<any[]>('/kitchen/active', {
      query: { branchId },
    });
  }

  async updateKitchenTicket(ticketId: string, status: string) {
    return this.request<any>(`/kitchen/tickets/${ticketId}/status`, {
      method: 'PATCH',
      body: { status },
    });
  }

  // Inventory
  async getWarehouses(businessId: string) {
    return this.request<any[]>('/warehouses', {
      query: { businessId },
    });
  }

  async getStockAlerts(businessId: string, warehouseId?: string) {
    return this.request<any[]>('/inventory/alerts', {
      query: { businessId, warehouseId },
    });
  }

  async getInventoryExistence(businessId: string, query?: { productId?: string; warehouseId?: string }) {
    return this.request<any>('/inventory/reports/existence', {
      query: { businessId, ...query },
    });
  }

  async getProductKardex(businessId: string, productId: string, limit?: number) {
    return this.request<any[]>('/inventory/reports/kardex', {
      query: { businessId, productId, limit },
    });
  }

  // Purchasing & Requisitions
  async getRequisitions(businessId: string, status?: string) {
    return this.request<any[]>('/requisitions', {
      query: { businessId, status },
    });
  }

  async approveRequisition(requisitionId: string, itemsApproved: any[]) {
    return this.request<any>(`/requisitions/${requisitionId}/approve`, {
      method: 'POST',
      body: { items: itemsApproved },
    });
  }

  async getPurchaseOrders(businessId: string, status?: string) {
    return this.request<any[]>('/purchase-orders', {
      query: { businessId, status },
    });
  }

  // Production / BOM
  async getBomRecipe(productId: string) {
    return this.request<any>(`/assembly/bom?productId=${productId}`);
  }

  // Direct passthrough to any current or future API endpoint
  async rawRequest<T = any>(endpoint: string, method: RequestOptions['method'] = 'GET', body?: any, query?: any) {
    return this.request<T>(endpoint, { method, body, query });
  }
}
