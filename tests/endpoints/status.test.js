import { expect } from 'chai';
import request from 'supertest';
import app from '../server';

describe('GET /status', () => {
  it('should return the status of Redis and DB connections', async () => {
    const res = await request(app).get('/status');
    expect(res.statusCode).to.equal(200);
    expect(res.body).to.have.property('redis');
    expect(res.body).to.have.property('db');
  });
});
