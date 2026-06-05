import * as net from 'net';
import * as http from 'http';
import * as https from 'https';

// Timeout wrapper for TCP connections
export function connectTCP(host: string, port: number, timeout = 3000): Promise<boolean> {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(timeout);
        socket.on('connect', () => {
            socket.destroy();
            resolve(true);
        });
        socket.on('error', () => {
            socket.destroy();
            resolve(false);
        });
        socket.on('timeout', () => {
            socket.destroy();
            resolve(false);
        });
        socket.connect(port, host);
    });
}

// Check if an HTTP endpoint returns a successful response
export function checkHTTP(url: string, timeout = 5000): Promise<{ ok: boolean; status: number; body?: string }> {
    return new Promise((resolve) => {
        const req = http.get(url, { timeout }, (res) => {
            let body = '';
            res.on('data', (chunk) => { body += chunk; });
            res.on('end', () => {
                resolve({ ok: res.statusCode === 200, status: res.statusCode || 0, body: body.slice(0, 500) });
            });
        });
        req.on('error', () => resolve({ ok: false, status: 0 }));
        req.on('timeout', () => { req.destroy(); resolve({ ok: false, status: 0 }); });
    });
}

// Check SSL certificate info
export function checkSSL(hostname: string, _port = 443, timeout = 5000): Promise<{
    ok: boolean;
    error?: string;
    cert?: { validFrom: string; validTo: string; issuer: string; subject: string; daysLeft: number };
}> {
    return new Promise((resolve) => {
        const req = https.get(`https://${hostname}`, { timeout, rejectUnauthorized: false }, (res) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const cert = (res.socket as any)?.getPeerCertificate?.();
            if (cert && Object.keys(cert).length > 0) {
                const validTo = new Date(cert.valid_to);
                const daysLeft = Math.floor((validTo.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                resolve({
                    ok: true,
                    cert: {
                        validFrom: cert.valid_from,
                        validTo: cert.valid_to,
                        issuer: cert.issuer?.O || cert.issuer?.CN || 'Unknown',
                        subject: cert.subject?.CN || 'Unknown',
                        daysLeft,
                    },
                });
            } else {
                resolve({ ok: true, error: 'Connected but no certificate returned' });
            }
            res.destroy();
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        req.on('error', (err: any) => resolve({ ok: false, error: err.code || err.message }));
        req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'TIMEOUT' }); });
    });
}
