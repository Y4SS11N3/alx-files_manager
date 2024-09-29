import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../server';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

describe('API Endpoints', () => {
  let mongoServer;
  let token;

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
    await redisClient.client.quit();
  });

  describe('GET /status', () => {
    it('should return the status of Redis and DB connections', async () => {
      const res = await request(app).get('/status');
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('redis', true);
      expect(res.body).toHaveProperty('db', true);
    });
  });

  describe('GET /stats', () => {
    it('should return the number of users and files', async () => {
      const res = await request(app).get('/stats');
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('users');
      expect(res.body).toHaveProperty('files');
    });
  });

  describe('POST /users', () => {
    it('should create a new user', async () => {
      const res = await request(app)
        .post('/users')
        .send({ email: 'test@example.com', password: 'password123' });
      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('email', 'test@example.com');
    });
  });

  describe('GET /connect', () => {
    it('should authenticate a user and return a token', async () => {
      const res = await request(app)
        .get('/connect')
        .auth('test@example.com', 'password123');
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('token');
      token = res.body.token;
    });
  });

  describe('GET /disconnect', () => {
    it('should disconnect a user', async () => {
      const res = await request(app)
        .get('/disconnect')
        .set('X-Token', token);
      expect(res.statusCode).toBe(204);
    });
  });

  describe('GET /users/me', () => {
    it('should return the current user', async () => {
      const res = await request(app)
        .get('/users/me')
        .set('X-Token', token);
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('email', 'test@example.com');
    });
  });

  describe('POST /files', () => {
    it('should create a new file', async () => {
      const res = await request(app)
        .post('/files')
        .set('X-Token', token)
        .send({
          name: 'test.txt',
          type: 'file',
          data: Buffer.from('Hello, World!').toString('base64'),
        });
      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('name', 'test.txt');
    });
  });

  describe('GET /files/:id', () => {
    let fileId;

    beforeAll(async () => {
      const res = await request(app)
        .post('/files')
        .set('X-Token', token)
        .send({
          name: 'test2.txt',
          type: 'file',
          data: Buffer.from('Hello, World!').toString('base64'),
        });
      fileId = res.body.id;
    });

    it('should return a file by id', async () => {
      const res = await request(app)
        .get(`/files/${fileId}`)
        .set('X-Token', token);
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('id', fileId);
      expect(res.body).toHaveProperty('name', 'test2.txt');
    });
  });

  describe('GET /files', () => {
    it('should return a list of files with pagination', async () => {
      const res = await request(app)
        .get('/files')
        .set('X-Token', token)
        .query({ page: 0 });
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('PUT /files/:id/publish', () => {
    let fileId;

    beforeAll(async () => {
      const res = await request(app)
        .post('/files')
        .set('X-Token', token)
        .send({
          name: 'test3.txt',
          type: 'file',
          data: Buffer.from('Hello, World!').toString('base64'),
        });
      fileId = res.body.id;
    });

    it('should publish a file', async () => {
      const res = await request(app)
        .put(`/files/${fileId}/publish`)
        .set('X-Token', token);
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('isPublic', true);
    });
  });

  describe('PUT /files/:id/unpublish', () => {
    let fileId;

    beforeAll(async () => {
      const res = await request(app)
        .post('/files')
        .set('X-Token', token)
        .send({
          name: 'test4.txt',
          type: 'file',
          data: Buffer.from('Hello, World!').toString('base64'),
        });
      fileId = res.body.id;
      await request(app)
        .put(`/files/${fileId}/publish`)
        .set('X-Token', token);
    });

    it('should unpublish a file', async () => {
      const res = await request(app)
        .put(`/files/${fileId}/unpublish`)
        .set('X-Token', token);
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('isPublic', false);
    });
  });

  describe('GET /files/:id/data', () => {
    let fileId;

    beforeAll(async () => {
      const res = await request(app)
        .post('/files')
        .set('X-Token', token)
        .send({
          name: 'test5.txt',
          type: 'file',
          data: Buffer.from('Hello, World!').toString('base64'),
        });
      fileId = res.body.id;
      await request(app)
        .put(`/files/${fileId}/publish`)
        .set('X-Token', token);
    });

    it('should return the content of a file', async () => {
      const res = await request(app)
        .get(`/files/${fileId}/data`)
        .set('X-Token', token);
      expect(res.statusCode).toBe(200);
      expect(res.text).toBe('Hello, World!');
    });
  });
});
