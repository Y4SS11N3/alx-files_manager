import { v4 as uuidv4 } from 'uuid';
import sha1 from 'sha1';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

class AuthController {
    static async getConnect(req, res) {
        try {
          const authHeader = req.headers.authorization;
          if (!authHeader || !authHeader.startsWith('Basic ')) {
            return res.status(401).json({ error: 'Unauthorized' });
          }
      
          const encodedCredentials = authHeader.split(' ')[1];
          const decodedCredentials = Buffer.from(encodedCredentials, 'base64').toString('ascii');
          const [email, password] = decodedCredentials.split(':');
      
          if (!email || !password) {
            return res.status(401).json({ error: 'Unauthorized' });
          }
      
          const hashedPassword = sha1(password);
          const db = await dbClient.connect();
          const user = await db.collection('users').findOne({ email, password: hashedPassword });
      
          if (!user) {
            return res.status(401).json({ error: 'Unauthorized' });
          }
      
          const token = uuidv4();
          const key = `auth_${token}`;
          await redisClient.set(key, user._id.toString(), 24 * 60 * 60);
      
          return res.status(200).json({ token });
        } catch (error) {
          console.error('Error in getConnect:', error);
          return res.status(500).json({ error: 'Internal Server Error' });
        }
      }

  static async getDisconnect(req, res) {
    const token = req.header('X-Token');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const key = `auth_${token}`;
    const userId = await redisClient.get(key);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await redisClient.del(key);
    return res.status(204).send();
  }
}

export default AuthController;
