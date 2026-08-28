export interface Employee {
  id: string;
  businessId?: string;
  branchId?: string;
  name: string;
  email?: string;
  pin: string;
  role: 'waiter' | 'cashier' | 'kitchen' | 'admin' | 'vendedor' | 'encargado' | 'empleado' | 'owner' | 'inventory_admin' | 'support_tech';
  roles?: Array<'waiter' | 'cashier' | 'kitchen' | 'admin' | 'vendedor' | 'encargado' | 'empleado' | 'owner' | 'inventory_admin' | 'support_tech'>;
}

export interface AdminUser {
  id: string;
  businessId?: string;
  name: string;
  email: string;
  role: 'owner' | 'inventory_admin' | 'support_tech';
  businessAccess: Array<{ businessId: string; role: 'owner' | 'inventory_admin' | 'support_tech' }>;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthUser {
  id: string;
  businessId?: string;
  branchId?: string;
  name: string;
  email?: string;
  role: 'owner' | 'inventory_admin' | 'support_tech' | 'admin' | 'waiter' | 'cashier' | 'kitchen' | 'vendedor' | 'encargado' | 'empleado';
  businessAccess?: Array<{ businessId: string; role: 'owner' | 'inventory_admin' | 'support_tech' }>;
}

export interface Warehouse {
  id: string;
  businessId: string;
  name: string;
  code?: string;
  address?: string;
  isActive: boolean;
  createdAt?: string;
}

export interface Branch {
  id: string;
  businessId: string;
  name: string;
  address?: string;
  phone?: string;
  roomConfigs?: string;
  createdAt?: string;
  version?: number;
}

export interface TicketFiscalConfiguration {
  id: string;
  businessId: string;
  branchId?: string | null;
  sellerDisplayName: string;
  legalName: string;
  fiscalId: string;
  branchName: string;
  branchAddress: string;
  phone?: string | null;
  receiptPrefix: string;
  taxMode: 'breakdown' | 'included';
  footerText?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  version?: number;
}

export interface SystemHealth {
  apiOnline: boolean;
  databaseConnected: boolean;
  databaseType: 'PostgreSQL' | 'Local JSON File';
  activeSessionsCount: number;
}

export interface Inquiry {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  inquiryType: string;
  status: string;
  createdAt: string;
}


export interface Category {
  id: string;
  businessId: string;
  name: string;
  description?: string;
  targetStation?: 'cocina' | 'barra';
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
  isActive?: boolean;
  imageUrl?: string;
  internalCode?: string;
  priceWholesale?: string;
  minStock?: string;
  maxStock?: string;
  saleType?: string;
  itemType?: 'raw_material' | 'wip' | 'finished_good' | 'service' | string;
  productionStrategy?: 'none' | 'backflush' | 'work_order' | string;
  uom?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BranchTable {
  id: string;
  branchId: string;
  label: string;
  capacity?: number;
  room?: string;
  state?: 'available' | 'occupied' | 'billing' | 'cleaning' | string;
  x?: number;
  y?: number;
  shape?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  price: string;
  assignedGuest?: number;
  notes?: string | null;
  isSent?: boolean;
  productName?: string;
  categoryName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Payment {
  id: string;
  orderId: string;
  amount: string;
  paymentMethod: 'cash' | 'card';
  referenceCode?: string | null;
  createdAt?: string;
}

export interface ActiveOrder {
  id: string;
  branchId: string;
  tableId: string;
  waiterId: string;
  state: 'open' | 'billing' | 'closed' | 'cancelled' | string;
  subtotal: string;
  discount: string;
  tax: string;
  total: string;
  items: OrderItem[];
  payments: Payment[];
  createdAt?: string;
  updatedAt?: string;
}

export interface KitchenTicket {
  id: string;
  orderId: string;
  status: 'pending' | 'preparing' | 'ready' | 'served';
  station: 'cocina' | 'barra' | string;
  tableLabel?: string;
  tableName?: string;
  items: OrderItem[];
  createdAt?: string;
  startedAt?: string | null;
  readyAt?: string | null;
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

export interface PurchaseOrderItem {
  id?: string;
  productId: string;
  quantityOrdered: number;
  unitCostEstimated: number;
  quantityReceived?: number;
  unitCostActual?: number;
  productName?: string;
}

export interface PurchaseOrder {
  id: string;
  businessId: string;
  providerId: string;
  warehouseId: string;
  poNumber: string;
  status: 'draft' | 'sent' | 'received' | 'partially_received' | 'cancelled';
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  items?: PurchaseOrderItem[];
  itemCount?: number;
  providerName?: string;
  warehouseName?: string;
}

export interface BranchRequisitionItem {
  id?: string;
  productId: string;
  quantityRequested: number;
  quantityApproved?: number;
  productName?: string;
}

export interface BranchRequisition {
  id: string;
  businessId: string;
  fromBranchId: string;
  toWarehouseId: string;
  requestedById: string;
    status: 'pending' | 'pending_approval' | 'approved' | 'rejected' | 'completed';
  notes?: string;
  approvalNotes?: string;
  approvedById?: string;
  createdAt: string;
  updatedAt: string;
  items?: BranchRequisitionItem[];
  itemCount?: number;
  fromBranchName?: string;
  toWarehouseName?: string;
  requestedByName?: string;
}

export interface InventoryAlert {
  id: string;
  productId: string;
  branchId: string | null;
  alertType: 'low_stock' | 'out_of_stock';
  threshold: string;
  currentQty: string;
  status: 'active' | 'acknowledged' | 'resolved';
  createdAt: string;
  resolvedAt: string | null;
  productName: string;
  productSku: string | null;
  branchName: string | null;
  itemType?: string;
  hasProvider?: boolean;
  transferableQty: number | null;
}

export interface InventoryAlertSummary {
  summary: {
    outOfStock: number;
    lowStock: number;
    branchAlerts: number;
    totalAlerts: number;
    pendingRequisitions: number;
    draftPurchaseOrders: number;
  };
  alerts: InventoryAlert[];
}

export interface BranchStockThreshold {
  id: string;
  productId: string;
  branchId: string;
  minStock: string;
  maxStock: string;
  productName?: string;
  branchName?: string;
}

export interface BranchCatalogEntry {
  id: string;
  branchId: string;
  productId: string;
  isSellable: boolean;
  isActive: boolean;
  productName?: string;
  productItemType?: string;
  globalIsSellable?: boolean;
}

const DEFAULT_API_URL = 'http://localhost:3000/api';

// Retrieve the base URL from env or fallback
export const getApiBaseUrl = (): string => {
  return (import.meta.env.VITE_API_URL as string) || DEFAULT_API_URL;
};

// Key used to store the admin token in localStorage
const TOKEN_KEY = 'X-Admin-Token';
const ACCESS_TOKEN_KEY = 'BC-Access-Token';
const REFRESH_TOKEN_KEY = 'BC-Refresh-Token';
const AUTH_USER_KEY = 'BC-Auth-User';
export const AUTH_EXPIRED_EVENT = 'business-control:auth-expired';

export const getAdminToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

export const getAccessToken = (): string | null => {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
};

const decodeJwtPayload = (token: string): { exp?: number } | null => {
  const [, payload] = token.split('.');
  if (!payload) return null;

  try {
    const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');
    const paddedPayload = normalizedPayload.padEnd(
      normalizedPayload.length + ((4 - normalizedPayload.length % 4) % 4),
      '=',
    );
    return JSON.parse(atob(paddedPayload));
  } catch {
    return null;
  }
};

export const isJwtExpired = (token: string, clockSkewSeconds = 30): boolean => {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return false;
  return payload.exp <= Math.floor(Date.now() / 1000) + clockSkewSeconds;
};

export const hasValidStoredSession = (): boolean => {
  const accessToken = getAccessToken();
  if (accessToken) {
    return !isJwtExpired(accessToken);
  }
  return Boolean(getAdminToken());
};

export const getAuthUser = (): AuthUser | null => {
  const raw = localStorage.getItem(AUTH_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
};

export const setAdminToken = (token: string): void => {
  localStorage.setItem(TOKEN_KEY, token);
};

export const clearAdminToken = (): void => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
};

const expireAuthSession = (): void => {
  clearAdminToken();
  window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
};

const storeAuthSession = (payload: { accessToken: string; refreshToken?: string; user: AuthUser }) => {
  localStorage.setItem(ACCESS_TOKEN_KEY, payload.accessToken);
  if (payload.refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, payload.refreshToken);
  }
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(payload.user));
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
  const accessToken = getAccessToken();
  const hadStoredSession = Boolean(accessToken || token);
  
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  headers.set('Pragma', 'no-cache');
  headers.set('Expires', '0');
  if (accessToken) {
    if (isJwtExpired(accessToken)) {
      expireAuthSession();
      throw new Error('Tu sesion expiro. Inicia sesion nuevamente.');
    }
    headers.set('Authorization', `Bearer ${accessToken}`);
  } else if (token) {
    headers.set('X-Admin-Token', token);
  }

  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers,
    cache: 'no-store',
  });

  if (!response.ok) {
    let errorMessage = `API Error: ${response.status} ${response.statusText}`;
    try {
      const errorJson = await response.json();
      errorMessage = errorJson.error || errorJson.message || errorMessage;
    } catch {
      // ignore JSON parse error
    }
    if (hadStoredSession && response.status === 401) {
      expireAuthSession();
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
  async login(email: string, password: string): Promise<{ accessToken: string; refreshToken: string; user: AuthUser }> {
    const data = await apiRequest<{ accessToken: string; refreshToken: string; user: AuthUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    storeAuthSession(data);
    return data;
  },

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

  async getAdminUsers(businessId: string): Promise<AdminUser[]> {
    return apiRequest<AdminUser[]>(`/admin-users?businessId=${businessId}`);
  },

  async addAdminUser(payload: {
    businessId: string;
    name: string;
    email: string;
    password: string;
    role: 'owner' | 'inventory_admin' | 'support_tech';
    businessAccess?: Array<{ businessId: string; role: 'owner' | 'inventory_admin' | 'support_tech' }>;
  }): Promise<AdminUser> {
    return apiRequest<AdminUser>('/admin-users', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateAdminUser(
    id: string,
    payload: Partial<Pick<AdminUser, 'name' | 'email' | 'role' | 'businessAccess'>> & { password?: string },
  ): Promise<AdminUser> {
    return apiRequest<AdminUser>(`/admin-users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async deactivateAdminUser(id: string): Promise<{ success: boolean; message: string }> {
    return apiRequest<{ success: boolean; message: string }>(`/admin-users/${id}`, {
      method: 'DELETE',
    });
  },

  async getUsers(businessId: string, branchId?: string): Promise<Employee[]> {
    let url = `/users?businessId=${businessId}`;
    if (branchId) {
      url += `&branchId=${branchId}`;
    }
    return apiRequest<Employee[]>(url);
  },

  /**
   * Create a new user profile for a business
   */
  async addUser(employee: Omit<Employee, 'id'>, businessId: string): Promise<{ success: boolean; user: Employee }> {
    const response = await apiRequest<Employee | Employee[]>('/users', {
      method: 'POST',
      body: JSON.stringify({
        ...employee,
        businessId,
      }),
    });
    
    const user = Array.isArray(response) ? response[0] : response;
    return { success: true, user };
  },

  async updateUser(
    id: string,
    employee: Partial<Omit<Employee, 'id' | 'businessId'>>,
  ): Promise<{ success: boolean; user: Employee }> {
    const response = await apiRequest<Employee>(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(employee),
    });
    return { success: true, user: response };
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
  async getProducts(businessId: string, branchId?: string): Promise<Product[]> {
    let url = `/products?businessId=${businessId}`;
    if (branchId) url += `&branchId=${branchId}`;
    return apiRequest<Product[]>(url);
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

  /**
   * Get all contact form inquiries
   */
  async getInquiries(status?: string): Promise<Inquiry[]> {
    const url = status ? `/admin/inquiries?status=${status}` : '/admin/inquiries';
    return apiRequest<Inquiry[]>(url);
  },

  /**
   * Update the status of an inquiry (e.g. resolve it)
   */
  async updateInquiryStatus(id: string, status: string): Promise<Inquiry> {
    return apiRequest<Inquiry>(`/admin/inquiries/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  /**
   * Get all warehouses for a business
   */
  async getWarehouses(businessId: string): Promise<Warehouse[]> {
    return apiRequest<Warehouse[]>(`/warehouses?businessId=${businessId}`);
  },

  /**
   * Create a new warehouse
   */
  async addWarehouse(warehouse: Omit<Warehouse, 'id' | 'isActive' | 'businessId'>, businessId: string): Promise<Warehouse> {
    return apiRequest<Warehouse>('/warehouses', {
      method: 'POST',
      body: JSON.stringify({
        ...warehouse,
        businessId,
      }),
    });
  },

  /**
   * Delete a warehouse (soft delete)
   */
  async deleteWarehouse(id: string): Promise<{ success: boolean; message: string }> {
    return apiRequest<{ success: boolean; message: string }>(`/warehouses/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * Get all branches for a business
   */
  async getBranches(businessId: string): Promise<Branch[]> {
    return apiRequest<Branch[]>(`/branches?businessId=${businessId}`);
  },

  /**
   * Create a new branch
   */
  async addBranch(branch: Omit<Branch, 'id' | 'businessId' | 'version'>, businessId: string): Promise<Branch> {
    return apiRequest<Branch>('/branches', {
      method: 'POST',
      body: JSON.stringify({
        ...branch,
        businessId,
      }),
    });
  },

  /**
   * Update a branch
   */
  async updateBranch(id: string, updates: Partial<Omit<Branch, 'id' | 'businessId' | 'version'>>): Promise<Branch> {
    return apiRequest<Branch>(`/branches/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  /**
   * Delete a branch (soft delete)
   */
  async deleteBranch(id: string): Promise<{ success: boolean; message: string }> {
    return apiRequest<{ success: boolean; message: string }>(`/branches/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * Get all tables for a branch
   */
  async getBranchTables(branchId: string): Promise<BranchTable[]> {
    return apiRequest<BranchTable[]>(`/branches/${branchId}/tables`);
  },

  /**
   * Create a new table in a branch
   */
  async addBranchTable(branchId: string, table: { label: string; capacity?: number; room?: string }): Promise<any> {
    return apiRequest<any>(`/branches/${branchId}/tables`, {
      method: 'POST',
      body: JSON.stringify(table),
    });
  },

  /**
   * Delete a table from a branch
   */
  async deleteBranchTable(branchId: string, tableId: string): Promise<any> {
    return apiRequest<any>(`/branches/${branchId}/tables/${tableId}`, {
      method: 'DELETE',
    });
  },

  /**
   * Autogenerate layout tables
   */
  async generateBranchTables(branchId: string, mode: 'cafeteria' | 'mostrador'): Promise<any[]> {
    return apiRequest<any[]>(`/branches/${branchId}/tables/generate`, {
      method: 'POST',
      body: JSON.stringify({ mode }),
    });
  },

  /**
   * Update details of an existing table
   */
  async updateBranchTable(
    branchId: string,
    tableId: string,
    updates: { label?: string; capacity?: number; room?: string; x?: number; y?: number; shape?: string },
  ): Promise<any> {
    return apiRequest<any>(`/branches/${branchId}/tables/${tableId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  async getTicketSettings(businessId: string, branchId?: string): Promise<TicketFiscalConfiguration> {
    let url = `/ticket-settings?businessId=${businessId}`;
    if (branchId) url += `&branchId=${branchId}`;
    return apiRequest<TicketFiscalConfiguration>(url);
  },

  async saveTicketSettings(payload: Omit<TicketFiscalConfiguration, 'id' | 'createdAt' | 'updatedAt' | 'version'>): Promise<TicketFiscalConfiguration> {
    return apiRequest<TicketFiscalConfiguration>('/ticket-settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async getActiveOrders(branchId: string): Promise<ActiveOrder[]> {
    return apiRequest<ActiveOrder[]>(`/orders/active?branchId=${branchId}`);
  },

  async getActiveOrdersByBusiness(businessId: string): Promise<LiveOrder[]> {
    return apiRequest<LiveOrder[]>(`/orders/active/business?businessId=${businessId}`);
  },

  async createOrder(payload: {
    branchId: string;
    tableId: string;
    waiterId: string;
    subtotal: string;
    discount?: string;
    tax?: string;
    total: string;
    items: Array<{
      productId: string;
      quantity: number;
      price: string;
      assignedGuest?: number;
      notes?: string;
    }>;
  }): Promise<ActiveOrder> {
    return apiRequest<ActiveOrder>('/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async addOrderItems(orderId: string, items: Array<{
    productId: string;
    quantity: number;
    price: string;
    assignedGuest?: number;
    notes?: string;
  }>): Promise<any> {
    return apiRequest<any>(`/orders/${orderId}/items`, {
      method: 'POST',
      body: JSON.stringify({ items }),
    });
  },

  async requestOrderBilling(orderId: string): Promise<ActiveOrder> {
    return apiRequest<ActiveOrder>(`/orders/${orderId}/billing`, {
      method: 'POST',
    });
  },

  async payOrder(orderId: string, payload: {
    amount: string;
    paymentMethod: 'cash' | 'card';
    referenceCode?: string;
  }): Promise<any> {
    return apiRequest<any>(`/orders/${orderId}/payments`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async sendOrderToKitchen(orderId: string): Promise<any> {
    return apiRequest<any>(`/kitchen/orders/${orderId}/send`, {
      method: 'POST',
    });
  },

  async getActiveKitchenTickets(branchId: string): Promise<KitchenTicket[]> {
    return apiRequest<KitchenTicket[]>(`/kitchen/active?branchId=${branchId}`);
  },

  async updateKitchenTicketStatus(ticketId: string, status: KitchenTicket['status']): Promise<KitchenTicket> {
    return apiRequest<KitchenTicket>(`/kitchen/tickets/${ticketId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  /**
   * Get stock levels for a business
   */
  async getStockLevels(businessId: string, warehouseId?: string, branchId?: string): Promise<any[]> {
    let url = `/inventory/stock?businessId=${businessId}`;
    if (warehouseId) url += `&warehouseId=${warehouseId}`;
    if (branchId) url += `&branchId=${branchId}`;
    return apiRequest<any[]>(url);
  },

  /**
   * Get purchase receipts history
   */
  async getReceipts(businessId: string): Promise<any[]> {
    return apiRequest<any[]>(`/inventory/receipts?businessId=${businessId}`);
  },

  /**
   * Record a new inventory receipt from a provider
   */
  async recordReceipt(
    payload: {
      providerId: string;
      warehouseId?: string;
      branchId?: string;
      documentNumber?: string;
      notes?: string;
      items: Array<{ productId: string; quantity: number; unitCost: number }>;
    },
    businessId: string
  ): Promise<{ success: boolean; receiptId: string }> {
    return apiRequest<{ success: boolean; receiptId: string }>('/inventory/receipts', {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        businessId,
      }),
    });
  },

  /**
   * Get recipe components for an assembled product
   */
  async getRecipe(productId: string): Promise<RecipeItem[]> {
    return apiRequest<RecipeItem[]>(`/recipes?productId=${productId}`);
  },

  /**
   * Configure/set recipe components for a product
   */
  async setRecipe(payload: {
    parentProductId: string;
    items: Array<{ ingredientProductId: string; quantityNeeded: number; wastePercent?: number }>;
  }): Promise<{ success: boolean }> {
    return apiRequest<{ success: boolean }>('/recipes', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * Get production runs history for a business
   */
  async getProductionRuns(businessId: string): Promise<ProductionRun[]> {
    return apiRequest<ProductionRun[]>(`/inventory/production?businessId=${businessId}`);
  },

  /**
   * Execute a production run assembly
   */
  async assembleProduct(payload: {
    warehouseId: string;
    productId: string;
    quantityProduced: number;
    notes?: string;
  }): Promise<{ success: boolean; productionRunId: string }> {
    return apiRequest<{ success: boolean; productionRunId: string }>('/inventory/production', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * Supplier product mappings
   */
  async getSupplierProducts(businessId: string, productId?: string, providerId?: string): Promise<SupplierProduct[]> {
    let url = `/supplier-products?businessId=${businessId}`;
    if (productId) url += `&productId=${productId}`;
    if (providerId) url += `&providerId=${providerId}`;
    return apiRequest<SupplierProduct[]>(url);
  },

  async addSupplierProduct(payload: Omit<SupplierProduct, 'id' | 'createdAt' | 'updatedAt'>): Promise<SupplierProduct> {
    return apiRequest<SupplierProduct>('/supplier-products', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateSupplierProduct(id: string, payload: Partial<SupplierProduct>): Promise<SupplierProduct> {
    return apiRequest<SupplierProduct>(`/supplier-products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async deleteSupplierProduct(id: string): Promise<{ success: boolean }> {
    return apiRequest<{ success: boolean }>(`/supplier-products/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * Stock transfers
   */
  async getTransfers(businessId: string): Promise<any[]> {
    return apiRequest<any[]>(`/inventory/transfers?businessId=${businessId}`);
  },

  async recordTransfer(payload: {
    fromWarehouseId?: string;
    fromBranchId?: string;
    toWarehouseId?: string;
    toBranchId?: string;
    notes?: string;
    items: Array<{ productId: string; quantity: number }>;
  }, businessId: string): Promise<{ success: boolean; transferId: string; status: string }> {
    return apiRequest<{ success: boolean; transferId: string; status: string }>('/inventory/transfers', {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        businessId,
      }),
    });
  },

  async receiveTransfer(id: string): Promise<{ success: boolean; transferId: string; status: string }> {
    return apiRequest<{ success: boolean; transferId: string; status: string }>(`/inventory/transfers/${id}/receive`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },

  async adjustStock(payload: {
    productId: string;
    warehouseId?: string;
    branchId?: string;
    quantity: number;
  }): Promise<{ success: boolean }> {
    return apiRequest<{ success: boolean }>('/inventory/stock/adjust', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async validateProductImport(businessId: string, rows: any[]): Promise<any[]> {
    return apiRequest<any[]>('/products/validate-import', {
      method: 'POST',
      body: JSON.stringify({ businessId, rows }),
    });
  },

  async bulkImportProducts(businessId: string, rows: any[]): Promise<{ success: boolean; successCount: number; errorCount: number }> {
    return apiRequest<{ success: boolean; successCount: number; errorCount: number }>('/products/bulk', {
      method: 'POST',
      body: JSON.stringify({ businessId, rows }),
    });
  },

  async logError(message: string, stack?: string): Promise<void> {
    try {
      await fetch(`${getApiBaseUrl()}/products/log-error`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, stack }),
      });
    } catch {
      // ignore
    }
  },

  async uploadBulkFile(businessId: string, file: File): Promise<any> {
    const baseUrl = getApiBaseUrl();
    const token = getAdminToken();

    // 1. Get signed URL & import ID from NestJS
    const urlHeaders = new Headers();
    if (token) {
      urlHeaders.set('X-Admin-Token', token);
    }
    const urlResponse = await fetch(
      `${baseUrl}/products/bulk/upload-url?businessId=${businessId}&filename=${encodeURIComponent(file.name)}`,
      { headers: urlHeaders }
    );
    if (!urlResponse.ok) {
      throw new Error(`Failed to generate upload URL: ${urlResponse.statusText}`);
    }
    const { id: importId, url, gcsFileName } = await urlResponse.json();

    // 2. Upload file binary directly to GCS using the signed URL
    const gcsResponse = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
      body: file,
    });
    if (!gcsResponse.ok) {
      throw new Error(`Failed to upload file to Cloud Storage: ${gcsResponse.statusText}`);
    }

    // 3. Trigger backend processing
    const processHeaders = new Headers();
    processHeaders.set('Content-Type', 'application/json');
    if (token) {
      processHeaders.set('X-Admin-Token', token);
    }
    const processResponse = await fetch(`${baseUrl}/products/bulk/process`, {
      method: 'POST',
      headers: processHeaders,
      body: JSON.stringify({
        businessId,
        importId,
        gcsFileName,
      }),
    });

    if (!processResponse.ok) {
      let errorMessage = `Process Error: ${processResponse.status} ${processResponse.statusText}`;
      try {
        const errorJson = await processResponse.json();
        errorMessage = errorJson.error || errorJson.message || errorMessage;
      } catch {
        // ignore
      }
      throw new Error(errorMessage);
    }

    return processResponse.json();
  },

  async getBulkImportHistory(businessId: string): Promise<any[]> {
    return apiRequest<any[]>(`/products/bulk/history?businessId=${businessId}`);
  },

  async getBulkImportDetails(id: string): Promise<any> {
    return apiRequest<any>(`/products/bulk/history/${id}`);
  },

  /**
   * Reports
   */
  async getTransfersSummaryReport(businessId: string, startDate?: string, endDate?: string): Promise<any[]> {
    let url = `/inventory/reports/transfers-summary?businessId=${businessId}`;
    if (startDate) url += `&startDate=${startDate}`;
    if (endDate) url += `&endDate=${endDate}`;
    return apiRequest<any[]>(url);
  },

  async getTransfersDetailedReport(businessId: string, branchId: string, startDate?: string, endDate?: string): Promise<any[]> {
    let url = `/inventory/reports/transfers-detailed?businessId=${businessId}&branchId=${branchId}`;
    if (startDate) url += `&startDate=${startDate}`;
    if (endDate) url += `&endDate=${endDate}`;
    return apiRequest<any[]>(url);
  },

  async getSalesDashboardReport(businessId: string, startDate?: string, endDate?: string, branchId?: string): Promise<SalesDashboardReport> {
    let url = `/reports/sales-dashboard?businessId=${businessId}`;
    if (startDate) url += `&startDate=${startDate}`;
    if (endDate) url += `&endDate=${endDate}`;
    if (branchId) url += `&branchId=${branchId}`;
    return apiRequest<SalesDashboardReport>(url);
  },

  async getProductSalesReport(params: {
    businessId: string;
    startDate?: string;
    endDate?: string;
    branchId?: string;
    categoryId?: string;
  }): Promise<ProductSalesReportLine[]> {
    let url = `/reports/sales/products?businessId=${params.businessId}`;
    if (params.startDate) url += `&startDate=${params.startDate}`;
    if (params.endDate) url += `&endDate=${params.endDate}`;
    if (params.branchId) url += `&branchId=${params.branchId}`;
    if (params.categoryId) url += `&categoryId=${params.categoryId}`;
    return apiRequest<ProductSalesReportLine[]>(url);
  },

  async getInventoryExistenceReport(params: {
    businessId: string;
    warehouseId?: string;
    branchId?: string;
    categoryId?: string;
    productId?: string;
    status?: string;
    stockFilter?: string;
    consolidated?: boolean;
  }): Promise<{ data: any[]; summary: { totalProducts: number; totalQuantity: number; totalCost: number } }> {
    let url = `/reports/inventory/existence?businessId=${params.businessId}`;
    if (params.warehouseId) url += `&warehouseId=${params.warehouseId}`;
    if (params.branchId) url += `&branchId=${params.branchId}`;
    if (params.categoryId) url += `&categoryId=${params.categoryId}`;
    if (params.productId) url += `&productId=${params.productId}`;
    if (params.status) url += `&status=${params.status}`;
    if (params.stockFilter) url += `&stockFilter=${params.stockFilter}`;
    if (params.consolidated) url += `&consolidated=true`;
    return apiRequest<{ data: any[]; summary: { totalProducts: number; totalQuantity: number; totalCost: number } }>(url);
  },

  async getInventoryKardexReport(params: {
    businessId: string;
    productId: string;
    warehouseId?: string;
    branchId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<any[]> {
    let url = `/reports/inventory/kardex?businessId=${params.businessId}&productId=${params.productId}`;
    if (params.warehouseId) url += `&warehouseId=${params.warehouseId}`;
    if (params.branchId) url += `&branchId=${params.branchId}`;
    if (params.startDate) url += `&startDate=${params.startDate}`;
    if (params.endDate) url += `&endDate=${params.endDate}`;
    return apiRequest<any[]>(url);
  },

  async getPaymentMethodsSalesReport(params: {
    businessId: string;
    startDate?: string;
    endDate?: string;
    branchId?: string;
  }): Promise<PaymentMethodSalesReportLine[]> {
    let url = `/reports/sales/payment-methods?businessId=${params.businessId}`;
    if (params.startDate) url += `&startDate=${params.startDate}`;
    if (params.endDate) url += `&endDate=${params.endDate}`;
    if (params.branchId) url += `&branchId=${params.branchId}`;
    return apiRequest<PaymentMethodSalesReportLine[]>(url);
  },

  async getCashShiftsList(params: {
    businessId: string;
    startDate?: string;
    endDate?: string;
    branchId?: string;
  }): Promise<CashShiftHeader[]> {
    let url = `/reports/cash-shifts?businessId=${params.businessId}`;
    if (params.startDate) url += `&startDate=${params.startDate}`;
    if (params.endDate) url += `&endDate=${params.endDate}`;
    if (params.branchId) url += `&branchId=${params.branchId}`;
    return apiRequest<CashShiftHeader[]>(url);
  },

  async getCashShiftAuditReport(id: string): Promise<CashShiftAuditReport> {
    return apiRequest<CashShiftAuditReport>(`/reports/cash-shifts/${id}/audit`);
  },

  async getTicketsToday(businessId: string, branchId?: string): Promise<TicketsTodayReport> {
    const params = new URLSearchParams({ businessId });
    if (branchId) params.set('branchId', branchId);
    return apiRequest<TicketsTodayReport>(`/reports/tickets/today?${params.toString()}`);
  },

  /**
   * Purchase Orders
   */
  async getPurchaseOrders(businessId: string): Promise<PurchaseOrder[]> {
    return apiRequest<PurchaseOrder[]>(`/purchase-orders?businessId=${businessId}`);
  },

  async getPurchaseOrder(id: string): Promise<PurchaseOrder> {
    return apiRequest<PurchaseOrder>(`/purchase-orders/${id}`);
  },

  async createPurchaseOrder(data: {
    businessId: string;
    providerId: string;
    warehouseId: string;
    orderNumber: string;
    createdBy: string;
    notes?: string;
    items: Array<{
      productId: string;
      quantity: number;
      estimatedUnitCost: number;
    }>;
  }): Promise<PurchaseOrder> {
    return apiRequest<PurchaseOrder>('/purchase-orders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updatePurchaseOrder(id: string, data: Partial<PurchaseOrder>): Promise<PurchaseOrder> {
    return apiRequest<PurchaseOrder>(`/purchase-orders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async deletePurchaseOrder(id: string): Promise<void> {
    return apiRequest<void>(`/purchase-orders/${id}`, {
      method: 'DELETE',
    });
  },

  async markPurchaseOrderAsSent(id: string): Promise<PurchaseOrder> {
    return apiRequest<PurchaseOrder>(`/purchase-orders/${id}/send`, {
      method: 'POST',
    });
  },

  async receivePurchaseOrder(id: string, data: {
    items: Array<{
      productId: string;
      quantityReceived: number;
      unitCostActual: number;
    }>;
    notes?: string;
  }): Promise<{ success: boolean; status: string; purchaseOrder: PurchaseOrder }> {
    return apiRequest<{ success: boolean; status: string; purchaseOrder: PurchaseOrder }>(`/purchase-orders/${id}/receive`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Branch Requisitions
   */
  async getAllRequisitions(businessId: string): Promise<BranchRequisition[]> {
    return apiRequest<BranchRequisition[]>(`/requisitions?businessId=${businessId}`);
  },

  async getPendingRequisitions(businessId: string): Promise<BranchRequisition[]> {
    return apiRequest<BranchRequisition[]>(`/requisitions/pending?businessId=${businessId}`);
  },

  async getRequisition(id: string): Promise<BranchRequisition> {
    return apiRequest<BranchRequisition>(`/requisitions/${id}`);
  },

  async createRequisition(data: {
    businessId: string;
    fromBranchId: string;
    toWarehouseId: string;
    createdBy: string;
    notes?: string;
    items: Array<{ productId: string; quantityRequested: number }>;
  }): Promise<BranchRequisition> {
    return apiRequest<BranchRequisition>('/requisitions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getBranchRequisitions(branchId: string, businessId?: string): Promise<BranchRequisition[]> {
    const url = businessId
      ? `/requisitions/branch/${branchId}?businessId=${businessId}`
      : `/requisitions/branch/${branchId}`;
    return apiRequest<BranchRequisition[]>(url);
  },

  async updateRequisitionStatus(id: string, data: {
  status: 'pending' | 'pending_approval' | 'approved' | 'rejected' | 'completed';
    notes?: string;
  }): Promise<BranchRequisition> {
    return apiRequest<BranchRequisition>(`/requisitions/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  /**
   * Intelligent Inventory Control — Panel de Inventario
   */
  async getInventoryAlertSummary(businessId: string, branchId?: string): Promise<InventoryAlertSummary> {
    let url = `/inventory/alerts/summary?businessId=${businessId}`;
    if (branchId) url += `&branchId=${branchId}`;
    return apiRequest<InventoryAlertSummary>(url);
  },

  async getInventoryAlerts(businessId: string, branchId?: string, status?: string): Promise<InventoryAlert[]> {
    let url = `/inventory/alerts?businessId=${businessId}`;
    if (branchId) url += `&branchId=${branchId}`;
    if (status) url += `&status=${status}`;
    return apiRequest<InventoryAlert[]>(url);
  },

  async refreshInventoryAlerts(businessId: string): Promise<{ processed: number; created: number; updated: number; resolved: number }> {
    return apiRequest(`/inventory/alerts/refresh`, {
      method: 'POST',
      body: JSON.stringify({ businessId }),
    });
  },

  async acknowledgeAlert(id: string): Promise<InventoryAlert> {
    return apiRequest<InventoryAlert>(`/inventory/alerts/${id}/acknowledge`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },

  async generateRequisitionFromAlert(id: string): Promise<{ requisitionId: string; quantityRequested: number; skipped?: boolean }> {
    return apiRequest(`/inventory/alerts/${id}/generate-requisition`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },

  async generatePurchaseOrderFromAlert(id: string): Promise<{ purchaseOrderId: string; poNumber: string; quantityOrdered: number }> {
    return apiRequest(`/inventory/alerts/${id}/generate-purchase-order`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },

  async generatePurchaseOrdersFromAlerts(alertIds: string[]): Promise<{
    success: boolean;
    purchaseOrders: Array<{ purchaseOrderId: string; poNumber: string; itemCount: number }>;
    skipped: string[];
  }> {
    return apiRequest('/inventory/alerts/generate-purchase-orders', {
      method: 'POST',
      body: JSON.stringify({ alertIds }),
    });
  },

  async generatePurchaseOrdersByProducts(items: Array<{ productId: string; quantity: number }>, businessId: string): Promise<{
    success: boolean;
    purchaseOrders: Array<{ purchaseOrderId: string; poNumber: string; itemCount: number }>;
    skipped: string[];
  }> {
    return apiRequest('/inventory/alerts/generate-purchase-orders-by-products', {
      method: 'POST',
      body: JSON.stringify({ businessId, items }),
    });
  },

  async runAutoPurchaseOrders(businessId: string): Promise<{ created: number; purchaseOrderIds: string[] }> {
    return apiRequest(`/inventory/alerts/auto-purchase-orders`, {
      method: 'POST',
      body: JSON.stringify({ businessId }),
    });
  },

  async getBranchThresholds(businessId: string, branchId?: string): Promise<BranchStockThreshold[]> {
    let url = `/inventory/thresholds?businessId=${businessId}`;
    if (branchId) url += `&branchId=${branchId}`;
    return apiRequest<BranchStockThreshold[]>(url);
  },

  async upsertBranchThreshold(data: {
    businessId: string;
    productId: string;
    branchId: string;
    minStock?: number;
    maxStock?: number;
  }): Promise<BranchStockThreshold> {
    return apiRequest<BranchStockThreshold>('/inventory/thresholds', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async deleteBranchThreshold(id: string): Promise<{ success: boolean }> {
    return apiRequest(`/inventory/thresholds/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * Per-branch catalog (what each sucursal can sell)
   */
  async getBranchCatalog(branchId: string): Promise<BranchCatalogEntry[]> {
    return apiRequest<BranchCatalogEntry[]>(`/branch-catalog?branchId=${branchId}`);
  },

  async upsertBranchCatalog(data: {
    businessId: string;
    branchId: string;
    productId: string;
    isSellable: boolean;
  }): Promise<BranchCatalogEntry> {
    return apiRequest<BranchCatalogEntry>('/branch-catalog', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async deleteBranchCatalog(id: string): Promise<{ success: boolean }> {
    return apiRequest<{ success: boolean }>(`/branch-catalog/${id}`, {
      method: 'DELETE',
    });
  },

  async copyBranchCatalog(data: {
    businessId: string;
    fromBranchId: string;
    toBranchId: string;
  }): Promise<{ success: boolean; copied: number }> {
    return apiRequest<{ success: boolean; copied: number }>('/branch-catalog/copy', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

export interface ProductSalesReportLine {
  productId: string;
  productName: string;
  sku: string;
  categoryName: string;
  quantitySold: number;
  averagePrice: number;
  grossSales: number;
  taxAmount: number;
  netSales: number;
}

export interface SalesDashboardReport {
  totalSales: number;
  totalOrdersCount: number;
  averageTicket: number;
  salesByBranch: Array<{ id: string; name: string; totalSales: number; ordersCount: number }>;
  topProducts: Array<{ id: string; name: string; sku: string | null; quantitySold: number; totalSales: number; profitMargin: number }>;
  topWaiters: Array<{ id: string; name: string; totalSales: number; ordersCount: number }>;
  topCashiers: Array<{ id: string; name: string; totalSales: number; ordersCount: number }>;
  hourlySales: Array<{ hour: number; totalSales: number }>;
}

export interface RecipeItem {
  id?: string;
  parentProductId: string;
  ingredientProductId: string;
  quantityNeeded: string | number;
  wastePercent?: string | number;
  ingredientName?: string;
  ingredientSku?: string;
}

export interface ProductionRun {
  id: string;
  warehouseName: string;
  productName: string;
  quantityProduced: string;
  assembledAt: string;
  notes?: string;
}

export interface SupplierProduct {
  id: string;
  businessId: string;
  productId: string;
  providerId: string;
  providerProductName: string;
  providerSku?: string;
  cost: string;
  conversionFactor: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PaymentMethodSalesReportLine {
  paymentMethod: string;
  totalAmount: number;
  paymentsCount: number;
  sharePercent: number;
}

export interface CashShiftHeader {
  id: string;
  cashierName: string;
  branchName: string;
  initialFloat: number | string;
  cashDrawerAmount: number | string;
  status: 'open' | 'closed';
  openedAt: string;
  closedAt: string | null;
}

export interface CashShiftAuditReport {
  shiftInfo: {
    id: string;
    cashierName: string;
    branchId: string;
    branchName: string;
    status: 'open' | 'closed';
    openedAt: string;
    closedAt: string | null;
    initialFloat: number;
    cashDrawerAmount: number;
  };
  salesSummary: {
    cashSales: number;
    cardSales: number;
    totalSales: number;
  };
  transactions: Array<{
    id: string;
    type: 'cash-in' | 'cash-out';
    amount: number;
    reason: string;
    createdAt: string;
  }>;
  expectedCash: number;
  discrepancy: number;
}

export interface TicketItem {
  quantity: number;
  productName: string;
  price: number;
  notes: string | null;
  assignedGuest: number | null;
}

export interface TicketPayment {
  method: string;
  amount: number;
  reference: string | null;
}

export interface TicketEntry {
  id: string;
  tableLabel: string;
  waiterName: string;
  createdAt: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  totalPaid: number;
  items: TicketItem[];
  payments: TicketPayment[];
}

export interface TicketsTodayReport {
  branchName: string;
  date: string;
  tickets: TicketEntry[];
}

export interface LiveOrderItem {
  id: string;
  quantity: number;
  price: string;
  notes: string | null;
  assignedGuest: number | null;
  productName: string | null;
}

export interface LiveOrderPayment {
  amount: string;
  method: string;
  reference: string | null;
}

export interface LiveOrder {
  id: string;
  state: string;
  total: string;
  subtotal: string;
  tax: string;
  discount: string;
  createdAt: string;
  branchId: string;
  branchName: string;
  tableLabel: string;
  tableRoom: string;
  waiterName: string;
  items: LiveOrderItem[];
  payments: LiveOrderPayment[];
}
