import { expect } from 'chai';
import request from 'supertest';
import app from '../server';

describe('GET /stats', () => {
  it('should return the number of users and files', async () => {
    const res = await request(app).get('/stats');
    expect(res.statusCode).to.equal(200);
    expect(res.body).to.have.property('users');
    expect(res.body).to.have.property('files');
    expect(res.body.users).to.be.a('number');
    expect(res.body.files).to.be.a('number');
  });
});
