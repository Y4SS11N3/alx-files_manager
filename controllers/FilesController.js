import { v4 as uuidv4 } from 'uuid';
import { ObjectId } from 'mongodb';
import fs from 'fs';
import path from 'path';
import mime from 'mime-types';
import Queue from 'bull';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const FOLDER_PATH = process.env.FOLDER_PATH || '/tmp/files_manager';

const fileQueue = new Queue('fileQueue', {
  redis: {
    host: '127.0.0.1',
    port: 6379,
  },
});

class FilesController {
  static async postUpload(req, res) {
    const token = req.header('X-Token');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const {
      name, type, parentId = 0, isPublic = false, data,
    } = req.body;

    if (!name) return res.status(400).json({ error: 'Missing name' });
    if (!type || !['folder', 'file', 'image'].includes(type)) return res.status(400).json({ error: 'Missing type' });
    if (!data && type !== 'folder') return res.status(400).json({ error: 'Missing data' });

    if (parentId !== 0) {
      const parentFile = await dbClient.db.collection('files').findOne({ _id: ObjectId(parentId) });
      if (!parentFile) return res.status(400).json({ error: 'Parent not found' });
      if (parentFile.type !== 'folder') return res.status(400).json({ error: 'Parent is not a folder' });
    }

    const newFile = {
      userId: ObjectId(userId),
      name,
      type,
      isPublic,
      parentId: parentId === 0 ? 0 : ObjectId(parentId),
    };

    if (type === 'folder') {
      const result = await dbClient.db.collection('files').insertOne(newFile);
      newFile.id = result.insertedId;
      return res.status(201).json(newFile);
    }

    const fileUuid = uuidv4();
    const localPath = path.join(FOLDER_PATH, fileUuid);

    await fs.promises.mkdir(FOLDER_PATH, { recursive: true });
    await fs.promises.writeFile(localPath, Buffer.from(data, 'base64'));

    newFile.localPath = localPath;

    const result = await dbClient.db.collection('files').insertOne(newFile);
    newFile.id = result.insertedId;

    if (type === 'image') {
      fileQueue.add({
        userId: userId.toString(),
        fileId: newFile.id.toString(),
      });
    }

    return res.status(201).json(newFile);
  }

  static async getShow(req, res) {
    const token = req.header('X-Token');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const fileId = req.params.id;
    if (!ObjectId.isValid(fileId)) return res.status(404).json({ error: 'Not found' });

    const file = await dbClient.db.collection('files').findOne({
      _id: ObjectId(fileId),
      userId: ObjectId(userId),
    });

    if (!file) return res.status(404).json({ error: 'Not found' });

    return res.status(200).json({
      id: file._id.toString(),
      userId: file.userId.toString(),
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId === 0 ? 0 : file.parentId.toString(),
    });
  }

  static async getIndex(req, res) {
    const token = req.header('X-Token');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const parentId = req.query.parentId || '0';
    const page = parseInt(req.query.page || '0', 10);
    const pageSize = 20;

    const query = { userId: ObjectId(userId) };
    if (parentId !== '0') {
      if (!ObjectId.isValid(parentId)) return res.status(200).json([]);
      query.parentId = ObjectId(parentId);
    } else {
      query.parentId = 0;
    }

    const files = await dbClient.db.collection('files')
      .aggregate([
        { $match: query },
        { $skip: page * pageSize },
        { $limit: pageSize },
        {
          $project: {
            _id: 0,
            id: { $toString: '$_id' },
            userId: { $toString: '$userId' },
            name: 1,
            type: 1,
            isPublic: 1,
            parentId: {
              $cond: { if: { $eq: ['$parentId', 0] }, then: 0, else: { $toString: '$parentId' } },
            },
          },
        },
      ])
      .toArray();

    return res.status(200).json(files);
  }

  static async putPublish(req, res) {
    const token = req.header('X-Token');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const fileId = req.params.id;
    const filesCollection = dbClient.db.collection('files');
    const file = await filesCollection.findOne({ _id: ObjectId(fileId), userId: ObjectId(userId) });

    if (!file) return res.status(404).json({ error: 'Not found' });

    await filesCollection.updateOne({ _id: ObjectId(fileId) }, { $set: { isPublic: true } });
    const updatedFile = await filesCollection.findOne({ _id: ObjectId(fileId) });

    return res.status(200).json(updatedFile);
  }

  static async putUnpublish(req, res) {
    const token = req.header('X-Token');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const fileId = req.params.id;
    const filesCollection = dbClient.db.collection('files');
    const file = await filesCollection.findOne({ _id: ObjectId(fileId), userId: ObjectId(userId) });

    if (!file) return res.status(404).json({ error: 'Not found' });

    await filesCollection.updateOne({ _id: ObjectId(fileId) }, { $set: { isPublic: false } });
    const updatedFile = await filesCollection.findOne({ _id: ObjectId(fileId) });

    return res.status(200).json(updatedFile);
  }

  static async getFile(req, res) {
    const { id: fileId } = req.params;
    const { size } = req.query;

    const file = await dbClient.db.collection('files').findOne({ _id: ObjectId(fileId) });
    if (!file) return res.status(404).json({ error: 'Not found' });

    if (!file.isPublic) {
      const token = req.header('X-Token');
      if (!token) return res.status(404).json({ error: 'Not found' });

      const userId = await redisClient.get(`auth_${token}`);
      if (!userId || userId !== file.userId.toString()) return res.status(404).json({ error: 'Not found' });
    }

    if (file.type === 'folder') return res.status(400).json({ error: "A folder doesn't have content" });

    let filePath = file.localPath;
    if (size) {
      if (!['500', '250', '100'].includes(size)) {
        return res.status(400).json({ error: 'Invalid size parameter' });
      }
      filePath = `${file.localPath}_${size}`;
    }

    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });

    const mimeType = mime.lookup(file.name);
    res.setHeader('Content-Type', mimeType);

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    return undefined;
  }
}

export default FilesController;
