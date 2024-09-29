import { MongoClient } from 'mongodb';

class DBClient {
  constructor() {
    this.host = process.env.DB_HOST || 'localhost';
    this.port = process.env.DB_PORT || 27017;
    this.database = process.env.DB_DATABASE || 'files_manager';
    this.url = `mongodb://${this.host}:${this.port}/${this.database}`;
    this.client = null;
    this.db = null;
  }

   async connect() {
    if (this.db) return this.db;
    try {
      this.client = await MongoClient.connect(this.url, { useUnifiedTopology: true });
      this.db = this.client.db(this.database);
      console.log('Connected successfully to MongoDB server');
      return this.db;
    } catch (err) {
      console.error('MongoDB connection error:', err);
      throw err;
    }
  }

  isAlive() {
    return !!this.client && !!this.db;
  }

  async nbUsers() {
    if (!this.db) await this.connect();
    return this.db.collection('users').countDocuments();
  }

  async nbFiles() {
    if (!this.db) await this.connect();
    return this.db.collection('files').countDocuments();
  }
}

const dbClient = new DBClient();
export default dbClient;
