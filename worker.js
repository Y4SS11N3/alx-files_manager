import Queue from 'bull';
import imageThumbnail from 'image-thumbnail';
import { ObjectID } from 'mongodb';
import fs from 'fs';
import dbClient from './utils/db';

const fileQueue = new Queue('fileQueue');

const generateThumbnail = async (path, options) => {
  try {
    const thumbnail = await imageThumbnail(path, options);
    const thumbnailPath = `${path}_${options.width}`;
    await fs.promises.writeFile(thumbnailPath, thumbnail);
  } catch (error) {
    console.error(`Error generating thumbnail: ${error}`);
  }
};

fileQueue.process(async (job) => {
  const { userId, fileId } = job.data;

  if (!fileId) {
    throw new Error('Missing fileId');
  }

  if (!userId) {
    throw new Error('Missing userId');
  }

  const filesCollection = dbClient.db.collection('files');
  const file = await filesCollection.findOne({
    _id: ObjectID(fileId),
    userId: ObjectID(userId),
  });

  if (!file) {
    throw new Error('File not found');
  }

  const sizes = [500, 250, 100];
  const thumbnailPromises = sizes.map((size) =>
    generateThumbnail(file.localPath, { width: size })
  );

  await Promise.all(thumbnailPromises);
});
