import { config } from './config.js';

export class PosApiClient {
  private baseUrl: string;
  private accessToken: string;

  constructor(
    baseUrl = config.apiUrl,
    accessToken = config.accessToken,
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.accessToken = accessToken;
  }

  private async get<T>(endpoint: string, query?: Record<string, string | number | boolean | undefined>): Promise<T> {
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
      'Authorization': `Bearer ${this.accessToken}`,
    };

    const response = await fetch(url, { method: 'GET', headers });

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
      throw new Error(`API Error [GET ${endpoint}]: ${errorDetail}`);
    }

    return response.json() as Promise<T>;
  }

  // Convenience Methods
  async getHealth() {
    return this.get<{ status: string; database?: string }>('/health');
  }

  // Catalog
  async getProducts(businessId: string, query?: { search?: string; categoryId?: string; isSellable?: boolean }) {
    return this.get<any[]>('/products', { businessId, ...query });
  }

  async getProductById(id: string) {
    return this.get<any>(`/products/${id}`);
  }

  async getCategories(businessId: string) {
    return this.get<any[]>('/categories', { businessId });
  }

  // Branches & Tables
  async getBranches(businessId: string) {
    return this.get<any[]>('/branches', { businessId });
  }

  async getTables(branchId: string) {
    return this.get<any[]>(`/branches/${branchId}/tables`);
  }

  // POS & Kitchen
  async getActiveOrders(branchId: string) {
    return this.get<any[]>('/orders/active', { branchId });
  }

  async getKitchenTickets(branchId: string) {
    return this.get<any[]>('/kitchen/active', { branchId });
  }

  // Inventory
  async getWarehouses(businessId: string) {
    return this.get<any[]>('/warehouses', { businessId });
  }

  async getStockAlerts(businessId: string, warehouseId?: string) {
    return this.get<any[]>('/inventory/alerts', { businessId, warehouseId });
  }

  async getInventoryExistence(businessId: string, query?: { productId?: string; warehouseId?: string }) {
    return this.get<any>('/inventory/reports/existence', { businessId, ...query });
  }

  async getProductKardex(businessId: string, productId: string, limit?: number) {
    return this.get<any[]>('/inventory/reports/kardex', { businessId, productId, limit });
  }

  // Purchasing & Requisitions
  async getRequisitions(businessId: string, status?: string) {
    return this.get<any[]>('/requisitions', { businessId, status });
  }

  async getPurchaseOrders(businessId: string, status?: string) {
    return this.get<any[]>('/purchase-orders', { businessId, status });
  }

  // Production / BOM
  async getBomRecipe(productId: string) {
    return this.get<any>('/assembly/bom', { productId });
  }

  async getErrorSummary(query: Record<string, string | number | boolean | undefined>) {
    return this.get<any>('/admin/logs/summary', query);
  }

  async searchLogs(query: Record<string, string | number | boolean | undefined>) {
    return this.get<any>('/admin/logs', query);
  }

  async getLogEntry(id: string) {
    return this.get<any>(`/admin/logs/${encodeURIComponent(id)}`);
  }
}
