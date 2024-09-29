import { expect } from 'chai';
import request from 'supertest';
import app from '../server';

describe('POST /users', () => {
  it('should create a new user', async () => {
    const res = await request(app)
      .post('/users')
      .send({
        email: 'test@example.com',
        password: 'password123'
      });
    expect(res.statusCode).to.equal(201);
    expect(res.body).to.have.property('id');
    expect(res.body).to.have.property('email');
    expect(res.body.email).to.equal('test@example.com');
  });

  it('should return an error if email is missing', async () => {
    const res = await request(app)
      .post('/users')
      .send({
        password: 'password123'
      });
    expect(res.statusCode).to.equal(400);
    expect(res.body).to.have.property('error');
    expect(res.body.error).to.equal('Missing email');
  });

});

describe('GET /users/me', () => {
  it('should return the authenticated user', async () => {
    const userRes = await request(app)
      .post('/users')
      .send({
        email: 'testme@example.com',
        password: 'password123'
      });
    const userId = userRes.body.id;

    const authRes = await request(app)
      .get('/connect')
      .auth('testme@example.com', 'password123');
    const token = authRes.body.token;

    const res = await request(app)
      .get('/users/me')
      .set('X-Token', token);

    expect(res.statusCode).to.equal(200);
    expect(res.body).to.have.property('id');
    expect(res.body).to.have.property('email');
    expect(res.body.id).to.equal(userId);
    expect(res.body.email).to.equal('testme@example.com');
  });

});
