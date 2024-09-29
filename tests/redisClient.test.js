import redisClient from '../utils/redis';

describe('Redis Client', () => {
  jest.setTimeout(10000);

  it('should connect to Redis', async () => {
    expect(redisClient.isAlive()).toBe(true);
  });

  it('should set and get a value', async () => {
    await redisClient.set('testKey', 'testValue', 10);
    const value = await redisClient.get('testKey');
    expect(value).toBe('testValue');
  });

  it('should delete a value', async () => {
    await redisClient.set('testKey', 'testValue', 10);
    await redisClient.del('testKey');
    const value = await redisClient.get('testKey');
    expect(value).toBeNull();
  });
});
