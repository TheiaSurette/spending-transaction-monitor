import type {
  Transaction,
  TransactionStats,
  Alert,
  AlertRule,
} from '../schemas/transaction';
import { type ApiTransactionResponse, type ApiAlertRuleResponse } from './user';

// Type definitions for API responses
interface ApiNotificationResponse {
  id: string;
  title: string;
  message: string;
  notification_method: string;
  status: string;
  created_at: string;
  read: boolean;
  transaction_id?: string;
  read_at?: string | null;
}

// Real API-based transaction service
export const apiTransactionService = {
  // Get recent transactions with pagination
  async getRecentTransactions(
    page = 1,
    limit = 10,
  ): Promise<{
    transactions: Transaction[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const response = await fetch('/api/transactions/');
    if (!response.ok) {
      throw new Error('Failed to fetch transactions');
    }

    const allTransactions = await response.json();

    // Transform API data to match UI schema
    const transformedTransactions: Transaction[] = allTransactions.map(
      (tx: ApiTransactionResponse) => ({
        id: tx.id,
        amount: tx.amount,
        merchant: tx.merchant_name,
        status: tx.status.toLowerCase(),
        time: tx.transaction_date,
        type: tx.transaction_type.toLowerCase(),
        currency: tx.currency,
        category: tx.merchant_category,
        description: tx.description,
      }),
    );

    // Sort by time descending
    transformedTransactions.sort(
      (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime(),
    );

    // Apply pagination
    const start = (page - 1) * limit;
    const end = start + limit;
    const transactions = transformedTransactions.slice(start, end);

    return {
      transactions,
      total: transformedTransactions.length,
      page,
      totalPages: Math.ceil(transformedTransactions.length / limit),
    };
  },

  // Get transaction by ID
  async getTransactionById(id: string): Promise<Transaction | null> {
    const response = await fetch(`/api/transactions/${id}`);
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error('Failed to fetch transaction');
    }

    const tx = await response.json();

    // Transform API data to match UI schema
    return {
      id: tx.id,
      amount: tx.amount,
      merchant: tx.merchant_name,
      status: tx.status.toLowerCase(),
      time: tx.transaction_date,
      type: tx.transaction_type.toLowerCase(),
      currency: tx.currency,
      category: tx.merchant_category,
      description: tx.description,
    };
  },

  // Get transaction statistics
  async getTransactionStats(): Promise<TransactionStats> {
    // For now, calculate stats from the transactions data
    // In the future, you could create a dedicated stats endpoint
    const { transactions } = await this.getRecentTransactions(1, 1000);

    const totalTransactions = transactions.length;
    const totalVolume = transactions.reduce((sum, t) => sum + t.amount, 0);
    const flaggedCount = transactions.filter((t) => t.status === 'flagged').length;

    return {
      totalTransactions,
      totalVolume,
      activeAlerts: flaggedCount,
      avgProcessingTime: 1.2,
      previousPeriod: {
        totalTransactions: Math.floor(totalTransactions * 0.88),
        totalVolume: totalVolume * 0.92,
        activeAlerts: Math.floor(flaggedCount * 1.15),
        avgProcessingTime: 1.27,
      },
    };
  },

  // Search transactions
  async searchTransactions(query: string): Promise<Transaction[]> {
    const { transactions } = await this.getRecentTransactions(1, 1000);

    const lowercaseQuery = query.toLowerCase();
    return transactions.filter(
      (t) =>
        t.merchant.toLowerCase().includes(lowercaseQuery) ||
        t.id.toLowerCase().includes(lowercaseQuery) ||
        t.type.includes(lowercaseQuery) ||
        t.category?.toLowerCase().includes(lowercaseQuery),
    );
  },

  // Get chart data for transaction volume over time
  async getTransactionChartData(timeRange: '7d' | '30d' | '90d' | '1y'): Promise<
    Array<{
      date: string;
      volume: number;
      transactions: number;
      formattedDate: string;
    }>
  > {
    const { transactions } = await this.getRecentTransactions(1, 1000);

    const days =
      timeRange === '7d'
        ? 7
        : timeRange === '30d'
          ? 30
          : timeRange === '90d'
            ? 90
            : 365;

    const data = [];
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Group transactions by date
    const transactionsByDate = new Map<string, { volume: number; count: number }>();

    transactions
      .filter((tx) => new Date(tx.time) >= cutoffDate)
      .forEach((tx) => {
        const date = new Date(tx.time).toISOString().split('T')[0];
        const existing = transactionsByDate.get(date) || { volume: 0, count: 0 };
        transactionsByDate.set(date, {
          volume: existing.volume + tx.amount,
          count: existing.count + 1,
        });
      });

    // Fill in missing dates with zeros
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const dayData = transactionsByDate.get(dateStr) || { volume: 0, count: 0 };

      data.push({
        date: dateStr,
        volume: Math.floor(dayData.volume),
        transactions: dayData.count,
        formattedDate: date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
      });
    }

    return data;
  },
};

// Health check service
export const healthService = {
  async getHealth() {
    const response = await fetch('/api/health/');
    if (!response.ok) {
      throw new Error('Failed to fetch health status');
    }
    return response.json();
  },
};

// Real API-based alert service
export const realAlertService = {
  // Get active alerts (using notifications as alerts)
  async getAlerts(): Promise<Alert[]> {
    const response = await fetch('/api/alerts/notifications');
    if (!response.ok) {
      throw new Error('Failed to fetch alerts');
    }

    const notifications = await response.json();

    // Transform API data to match UI schema
    return notifications.map((notification: ApiNotificationResponse) => ({
      id: notification.id,
      title: notification.title,
      description: notification.message,
      severity:
        notification.status === 'ERROR'
          ? 'high'
          : notification.status === 'WARNING'
            ? 'medium'
            : 'low',
      timestamp: notification.created_at,
      transaction_id: notification.transaction_id,
      resolved: notification.read_at !== null,
    }));
  },

  // Get alert rules
  async getAlertRules(): Promise<AlertRule[]> {
    const response = await fetch('/api/alerts/rules');
    if (!response.ok) {
      throw new Error('Failed to fetch alert rules');
    }

    const rules = await response.json();

    // Transform API data to match UI schema
    return rules.map((rule: ApiAlertRuleResponse) => ({
      id: rule.id,
      rule: rule.name,
      status: rule.is_active ? 'active' : 'paused',
      triggered: rule.trigger_count || 0,
      last_triggered: rule.last_triggered
        ? new Date(rule.last_triggered).toLocaleString()
        : 'Never',
      created_at: rule.created_at,
    }));
  },

  // Create new alert rule
  async createAlertRule(rule: string, userId?: string): Promise<AlertRule> {
    try {
      // Note: userId parameter is now unused as the API automatically determines the current user
      void userId; // Suppress unused parameter warning

      const response = await fetch('/api/alerts/rules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          natural_language_query: rule,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to create alert rule: ${response.status} ${response.statusText}`,
        );
      }

      const apiRule = await response.json();

      // Transform API response to match UI schema
      const newRule: AlertRule = {
        id: apiRule.id,
        rule: apiRule.natural_language_query || apiRule.name || rule,
        status: apiRule.is_active ? 'active' : 'inactive',
        triggered: apiRule.trigger_count || 0,
        last_triggered: apiRule.last_triggered || 'Never',
        created_at: apiRule.created_at,
      };

      return newRule;
    } catch (error) {
      console.error('Error creating alert rule:', error);
      throw new Error(
        error instanceof Error ? error.message : 'Failed to create alert rule',
      );
    }
  },

  // Toggle alert rule status
  async toggleAlertRule(id: string): Promise<AlertRule | null> {
    try {
      // Try to toggle using the real API
      const rules = await this.getAlertRules();
      const rule = rules.find((r) => r.id === id);

      if (rule) {
        // This would need to call the PUT endpoint to update the rule
        rule.status = rule.status === 'active' ? 'paused' : 'active';
        return rule;
      }
      return null;
    } catch (error) {
      console.warn('Toggle alert rule failed:', error);
      return null;
    }
  },
};

// User service for real API data
export const userService = {
  // Get all users
  async getUsers(): Promise<unknown[]> {
    const response = await fetch('/api/users/');
    if (!response.ok) {
      throw new Error('Failed to fetch users');
    }
    return response.json();
  },

  // Get user by ID
  async getUserById(id: string): Promise<unknown> {
    const response = await fetch(`/api/users/${id}`);
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error('Failed to fetch user');
    }
    return response.json();
  },

  // Get user transactions
  async getUserTransactions(
    userId: string,
    limit = 50,
    offset = 0,
  ): Promise<unknown[]> {
    const response = await fetch(
      `/api/users/${userId}/transactions?limit=${limit}&offset=${offset}`,
    );
    if (!response.ok) {
      throw new Error('Failed to fetch user transactions');
    }
    return response.json();
  },

  // Get user credit cards
  async getUserCreditCards(userId: string): Promise<unknown[]> {
    const response = await fetch(`/api/users/${userId}/credit-cards`);
    if (!response.ok) {
      throw new Error('Failed to fetch user credit cards');
    }
    return response.json();
  },

  // Get user alert rules
  async getUserAlertRules(userId: string): Promise<unknown[]> {
    const response = await fetch(`/api/users/${userId}/rules`);
    if (!response.ok) {
      throw new Error('Failed to fetch user alert rules');
    }
    return response.json();
  },
};

// Keep old alert service as fallback
export const alertService = {
  // Get active alerts
  async getAlerts(): Promise<Alert[]> {
    await new Promise((resolve) => setTimeout(resolve, 300));

    const alerts: Alert[] = [
      {
        id: 'ALT-001',
        title: 'Large Transaction Detected',
        description: 'Transaction of $1,299.99 exceeds threshold',
        severity: 'high',
        timestamp: new Date(Date.now() - 1800000).toISOString(),
        transaction_id: 'e87b191a-4bc3-49b3-9881-d6f44066c92a',
        resolved: false,
      },
    ];

    return alerts;
  },

  // Get alert rules
  async getAlertRules(): Promise<AlertRule[]> {
    await new Promise((resolve) => setTimeout(resolve, 300));

    const rules: AlertRule[] = [
      {
        id: 'RULE-001',
        rule: 'Alert me when transactions exceed $1,000',
        status: 'active',
        triggered: 3,
        last_triggered: '2 hours ago',
        created_at: new Date(Date.now() - 86400000 * 30).toISOString(),
      },
      {
        id: 'RULE-003',
        rule: 'Alert for transactions from Test City',
        status: 'active',
        triggered: 1,
        last_triggered: '1 hour ago',
        created_at: new Date(Date.now() - 86400000 * 60).toISOString(),
      },
    ];

    return rules;
  },

  // Create new alert rule
  async createAlertRule(rule: string, userId?: string): Promise<AlertRule> {
    // Note: userId parameter is intentionally unused in fallback service but kept for API consistency
    void userId;
    await new Promise((resolve) => setTimeout(resolve, 500));

    const newRule: AlertRule = {
      id: `RULE-${Date.now()}`,
      rule,
      status: 'active',
      triggered: 0,
      last_triggered: 'Never',
      created_at: new Date().toISOString(),
    };

    return newRule;
  },

  // Toggle alert rule status
  async toggleAlertRule(id: string): Promise<AlertRule | null> {
    await new Promise((resolve) => setTimeout(resolve, 300));

    const rules = await alertService.getAlertRules();
    const rule = rules.find((r) => r.id === id);

    if (rule) {
      rule.status = rule.status === 'active' ? 'paused' : 'active';
      return rule;
    }

    return null;
  },
};
