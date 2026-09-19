import express, { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import fsp from 'fs/promises';
import uploadRouter from '../routes/upload';
import { saveUpload, signatureMatches, MAX_UPLOAD_BYTES } from '../services/uploadService';

jest.mock('../middleware/authorize', () => ({
  authorize: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));
jest.mock('../services/databaseService', () => ({ query: jest.fn() }));
jest.mock('../services/dataGovernanceService', () => ({ getFarmerForPrincipal: jest.fn() }));
jest.mock('../services/objectStorageService', () => ({ objectStorage: { getBackendType: () => 'local' } }));
jest.mock('../utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('fs', () => ({ mkdirSync: jest.fn() }));
jest.mock('fs/promises', () => ({ stat: jest.fn(), readFile: jest.fn(), open: jest.fn(), unlink: jest.fn() }));
jest.mock('multer', () => {
  const passthrough = () => (_req: Request, _res: Response, next: NextFunction) => next();
  return Object.assign(jest.fn(() => ({ single: passthrough, array: passthrough })), {
    diskStorage: jest.fn(),
    MulterError: class extends Error {},
  });
});
jest.mock('../services/uploadService', () => ({
  saveUpload: jest.fn(),
  MAX_UPLOAD_BYTES: 1024,
  UPLOAD_TYPES: {},
  signatureMatches: jest.fn(),
  normalizeMimeType: (mime: string) => mime,
}));

const files: Express.Multer.File[] = [];
const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.user = { userId: 'user-1', role: 'admin', email: 'admin@example.test' };
  req.files = files;
  next();
});
app.use(uploadRouter);

const content = Buffer.from('test-file-content');
const close = jest.fn();
const read = jest.fn();

beforeEach(() => {
  jest.resetAllMocks();
  files.splice(0, files.length, {
    path: '/tmp/test-upload', originalname: 'image.png', mimetype: 'image/png', fieldname: 'files',
  } as Express.Multer.File);
  jest.mocked(fsp.stat).mockResolvedValue({ size: content.length } as Awaited<ReturnType<typeof fsp.stat>>);
  jest.mocked(fsp.readFile).mockResolvedValue(content);
  jest.mocked(fsp.unlink).mockResolvedValue(undefined);
  close.mockResolvedValue(undefined);
  read.mockResolvedValue({ buffer: content, bytesRead: content.length });
  jest.mocked(fsp.open).mockResolvedValue({ read, close } as unknown as Awaited<ReturnType<typeof fsp.open>>);
  jest.mocked(signatureMatches).mockReturnValue(true);
  jest.mocked(saveUpload).mockResolvedValue({ id: 'upload-1' } as Awaited<ReturnType<typeof saveUpload>>);
});

it('validates a spooled file head, closes the handle, and cleans up after success', async () => {
  const response = await request(app).post('/upload/multiple').send({});
  expect(response.status).toBe(201);
  expect(read).toHaveBeenCalledWith(expect.any(Buffer), 0, 64, 0);
  expect(signatureMatches).toHaveBeenCalledWith(content, 'image/png');
  expect(close).toHaveBeenCalledTimes(1);
  expect(saveUpload).toHaveBeenCalledWith(expect.objectContaining({ buffer: content, ownerUserId: 'user-1' }));
  expect(fsp.unlink).toHaveBeenCalledWith('/tmp/test-upload');
});

it('inspects the full SVG content instead of only its header', async () => {
  files[0].mimetype = 'image/svg+xml';
  const response = await request(app).post('/upload/multiple').send({});
  expect(response.status).toBe(201);
  expect(fsp.open).not.toHaveBeenCalled();
  expect(signatureMatches).toHaveBeenCalledWith(content, 'image/svg+xml');
});

it.each([0, MAX_UPLOAD_BYTES + 1])('rejects a spooled size of %s bytes and still cleans up', async size => {
  jest.mocked(fsp.stat).mockResolvedValue({ size } as Awaited<ReturnType<typeof fsp.stat>>);
  const response = await request(app).post('/upload/multiple').send({});
  expect(response.status).toBe(400);
  expect(response.body.error).toBe('Uploaded file is empty or exceeds the size limit');
  expect(saveUpload).not.toHaveBeenCalled();
  expect(fsp.unlink).toHaveBeenCalledWith('/tmp/test-upload');
});

it('rejects a signature mismatch before saving any file in the batch', async () => {
  files.push({ ...files[0], path: '/tmp/test-upload-2' });
  jest.mocked(signatureMatches).mockReturnValueOnce(true).mockReturnValueOnce(false);
  const response = await request(app).post('/upload/multiple').send({});
  expect(response.status).toBe(400);
  expect(response.body.error).toBe('File content does not match declared type');
  expect(saveUpload).not.toHaveBeenCalled();
  expect(fsp.unlink).toHaveBeenCalledWith('/tmp/test-upload');
  expect(fsp.unlink).toHaveBeenCalledWith('/tmp/test-upload-2');
});

it('closes the file handle and cleans up if reading the header fails', async () => {
  read.mockRejectedValueOnce(new Error('Read failed'));
  const response = await request(app).post('/upload/multiple').send({});
  expect(response.status).toBe(400);
  expect(response.body.error).toBe('Read failed');
  expect(close).toHaveBeenCalledTimes(1);
  expect(saveUpload).not.toHaveBeenCalled();
  expect(fsp.unlink).toHaveBeenCalledWith('/tmp/test-upload');
});

it('preserves handler status codes and cleans up when saving fails', async () => {
  jest.mocked(saveUpload).mockRejectedValueOnce(Object.assign(new Error('Storage unavailable'), { statusCode: 503 }));
  const response = await request(app).post('/upload/multiple').send({});
  expect(response.status).toBe(503);
  expect(response.body.error).toBe('Storage unavailable');
  expect(fsp.unlink).toHaveBeenCalledWith('/tmp/test-upload');
});
