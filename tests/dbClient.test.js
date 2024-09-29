import { expect } from 'chai';
import sinon from 'sinon';
import dbClient from '../utils/db';

describe('DB Client', () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should connect to MongoDB', () => {
    expect(dbClient.isAlive()).to.be.true;
  });

  it('should return the number of users', async () => {
    const usersCount = await dbClient.nbUsers();
    expect(usersCount).to.be.a('number');
  });

  it('should return the number of files', async () => {
    const filesCount = await dbClient.nbFiles();
    expect(filesCount).to.be.a('number');
  });
});
