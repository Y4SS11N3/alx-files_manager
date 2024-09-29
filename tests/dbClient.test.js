import { MongoMemoryServer } from 'mongodb-memory-server';
import dbClient from '../utils/db';

describe('DB Client', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    process.env.DB_HOST = new URL(mongoUri).hostname;
    process.env.DB_PORT = new URL(mongoUri).port;
    process.env.DB_DATABASE = 'files_manager_test';
    await dbClient.connect();
  });

  afterAll(async () => {
    await dbClient.client.close();
    await mongoServer.stop();
  });

  it('should connect to the database', async () => {
    expect(dbClient.isAlive()).toBe(true);
  });

  it('should return the number of users', async () => {
    const usersCount = await dbClient.nbUsers();
    expect(typeof usersCount).toBe('number');
  });

  it('should return the number of files', async () => {
    const filesCount = await dbClient.nbFiles();
    expect(typeof filesCount).toBe('number');
  });
});
