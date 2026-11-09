import request from 'supertest';
import app from '../app';

describe('MCP route aliases', () => {
  beforeAll(async () => {
    let ready = false;
    for (let attempt = 0; attempt < 20; attempt++) {
      const response = await request(app).get('/api/v1/mcp/health');
      if (response.status === 200) {
        ready = true;
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    if (!ready) throw new Error('MCP health endpoint did not become ready after 20 attempts');
  });

  it.each(['/api/mcp/health', '/api/v1/mcp/health'])(
    'serves the public MCP health check at %s',
    async path => {
      const response = await request(app).get(path);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: { status: 'healthy', protocol: 'MCP' },
      });
    }
  );

  it.each(['/api/mcp/tools', '/api/v1/mcp/tools'])(
    'routes the protected tools endpoint at %s',
    async path => {
      const response = await request(app).get(path);

      expect(response.status).toBe(401);
      expect(response.body.error).toMatch(/MCP access requires/);
    }
  );
});
