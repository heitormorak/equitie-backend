import pool from '../config/database';

export class DatabaseService {
  // Test database connection
  static async testConnection() {
    try {
      const client = await pool.connect();
      const result = await client.query('SELECT NOW()');
      client.release();
      return { success: true, timestamp: result.rows[0].now };
    } catch (error) {
      console.error('Database connection test failed:', error);
      return { success: false, error };
    }
  }

  // Execute a query
  static async query(text: string, params?: any[]) {
    try {
      const start = Date.now();
      const result = await pool.query(text, params);
      const duration = Date.now() - start;
      console.log('Executed query', { text, duration, rows: result.rowCount });
      return result;
    } catch (error) {
      console.error('Query execution failed:', error);
      throw error;
    }
  }

  // Get a client from the pool
  static async getClient() {
    return await pool.connect();
  }
}

export default DatabaseService; 