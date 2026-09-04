/**
 * Safaricom M-Pesa Daraja integration (Lipa Na M-Pesa Online / STK Push).
 *
 * Contract (Daraja v1):
 *   GET  {base}/oauth/v1/generate?grant_type=client_credentials   Basic(consumerKey:consumerSecret)
 *   POST {base}/mpesa/stkpush/v1/processrequest                    Bearer token
 *        { BusinessShortCode, Password: base64(Shortcode+Passkey+Timestamp), Timestamp: YYYYMMDDHHmmss,
 *          TransactionType: 'CustomerPayBillOnline', Amount, PartyA: msisdn, PartyB: shortcode,
 *          PhoneNumber: msisdn, CallBackURL, AccountReference, TransactionDesc }
 *        -> { MerchantRequestID, CheckoutRequestID, ResponseCode: '0', ResponseDescription, CustomerMessage }
 *   Callback POST body:
 *        { Body: { stkCallback: { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc,
 *          CallbackMetadata?: { Item: [{Name:'Amount',Value}, {Name:'MpesaReceiptNumber',Value}, {Name:'PhoneNumber',Value}, ...] } } } }
 *
 * Safaricom does not sign callbacks. Authenticity relies on an unguessable callback
 * URL (secret path segment) — and we still re-check the amount against the plan.
 */
import axios from 'axios';
import { logger } from '@/utils/logger';

export interface MpesaConfig {
    consumerKey: string;
    consumerSecret: string;
    shortcode: string;
    passkey: string;
    env: 'sandbox' | 'production';
    callbackSecret: string;
    publicApiUrl: string;
    kesPerUsd?: number;
}

export function readMpesaConfig(): MpesaConfig | null {
    const consumerKey = process.env.MPESA_CONSUMER_KEY;
    const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
    const shortcode = process.env.MPESA_SHORTCODE;
    const passkey = process.env.MPESA_PASSKEY;
    const callbackSecret = process.env.MPESA_CALLBACK_SECRET;
    const publicApiUrl = process.env.PUBLIC_API_URL;
    if (!consumerKey || !consumerSecret || !shortcode || !passkey || !callbackSecret || !publicApiUrl) return null;
    const kes = Number(process.env.MPESA_KES_PER_USD);
    return {
        consumerKey, consumerSecret, shortcode, passkey, callbackSecret,
        publicApiUrl: publicApiUrl.replace(/\/+$/, ''),
        env: process.env.MPESA_ENV === 'production' ? 'production' : 'sandbox',
        kesPerUsd: Number.isFinite(kes) && kes > 0 ? kes : undefined,
    };
}

function baseUrl(env: MpesaConfig['env']): string {
    return env === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';
}

/** Normalise a Kenyan MSISDN to 2547XXXXXXXX / 2541XXXXXXXX. */
export function normalizeMsisdn(input: string): string | null {
    const digits = input.replace(/\D/g, '');
    if (/^254(7|1)\d{8}$/.test(digits)) return digits;
    if (/^0(7|1)\d{8}$/.test(digits)) return `254${digits.slice(1)}`;
    if (/^(7|1)\d{8}$/.test(digits)) return `254${digits}`;
    return null;
}

function timestamp(d = new Date()): string {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

let tokenCache: { token: string; expiresAt: number } | null = null;

export class MpesaDarajaService {
    constructor(private readonly cfg: MpesaConfig) {}

    static fromEnv(): MpesaDarajaService | null {
        const cfg = readMpesaConfig();
        return cfg ? new MpesaDarajaService(cfg) : null;
    }

    get callbackUrl(): string {
        return `${this.cfg.publicApiUrl}/api/v1/billing/mpesa/callback/${this.cfg.callbackSecret}`;
    }

    /** Convert a plan price to whole KES as Daraja requires. */
    toKes(amount: number, currency: string): number | null {
        const cur = currency.toUpperCase();
        if (cur === 'KES') return Math.ceil(amount);
        if (cur === 'USD' && this.cfg.kesPerUsd) return Math.ceil(amount * this.cfg.kesPerUsd);
        return null;
    }

    async getAccessToken(): Promise<string> {
        if (tokenCache && tokenCache.expiresAt > Date.now() + 30_000) return tokenCache.token;
        const auth = Buffer.from(`${this.cfg.consumerKey}:${this.cfg.consumerSecret}`).toString('base64');
        const res = await axios.get<{ access_token: string; expires_in: string }>(
            `${baseUrl(this.cfg.env)}/oauth/v1/generate?grant_type=client_credentials`,
            { headers: { Authorization: `Basic ${auth}` }, timeout: 15000 }
        );
        const ttl = Number(res.data.expires_in) || 3599;
        tokenCache = { token: res.data.access_token, expiresAt: Date.now() + ttl * 1000 };
        return tokenCache.token;
    }

    async stkPush(params: { msisdn: string; amountKes: number; accountReference: string; description: string }): Promise<{
        merchantRequestId: string; checkoutRequestId: string; customerMessage: string;
    }> {
        const token = await this.getAccessToken();
        const ts = timestamp();
        const password = Buffer.from(`${this.cfg.shortcode}${this.cfg.passkey}${ts}`).toString('base64');
        const body = {
            BusinessShortCode: this.cfg.shortcode,
            Password: password,
            Timestamp: ts,
            TransactionType: 'CustomerPayBillOnline',
            Amount: Math.max(1, Math.round(params.amountKes)),
            PartyA: params.msisdn,
            PartyB: this.cfg.shortcode,
            PhoneNumber: params.msisdn,
            CallBackURL: this.callbackUrl,
            AccountReference: params.accountReference.slice(0, 12),
            TransactionDesc: params.description.slice(0, 13),
        };
        const res = await axios.post<{ MerchantRequestID: string; CheckoutRequestID: string; ResponseCode: string; ResponseDescription: string; CustomerMessage: string }>(
            `${baseUrl(this.cfg.env)}/mpesa/stkpush/v1/processrequest`,
            body,
            { headers: { Authorization: `Bearer ${token}` }, timeout: 20000 }
        );
        if (res.data.ResponseCode !== '0') {
            throw new Error(`Daraja rejected STK push: ${res.data.ResponseDescription || res.data.ResponseCode}`);
        }
        logger.info(`M-Pesa STK push accepted: ${res.data.CheckoutRequestID}`);
        return {
            merchantRequestId: res.data.MerchantRequestID,
            checkoutRequestId: res.data.CheckoutRequestID,
            customerMessage: res.data.CustomerMessage,
        };
    }

    /** Parse a Daraja STK callback body. Returns null if the shape is unrecognised. */
    static parseCallback(body: unknown): {
        checkoutRequestId: string; merchantRequestId: string; resultCode: number; resultDesc: string;
        amount?: number; receipt?: string; phone?: string; transactionDate?: string;
    } | null {
        const cb = (body as { Body?: { stkCallback?: Record<string, unknown> } })?.Body?.stkCallback;
        if (!cb || typeof cb.CheckoutRequestID !== 'string') return null;
        const out = {
            checkoutRequestId: String(cb.CheckoutRequestID),
            merchantRequestId: String(cb.MerchantRequestID ?? ''),
            resultCode: Number(cb.ResultCode),
            resultDesc: String(cb.ResultDesc ?? ''),
        } as ReturnType<typeof MpesaDarajaService.parseCallback> & object;
        const items = (cb.CallbackMetadata as { Item?: Array<{ Name: string; Value?: unknown }> } | undefined)?.Item ?? [];
        for (const it of items) {
            if (it.Name === 'Amount') out.amount = Number(it.Value);
            if (it.Name === 'MpesaReceiptNumber') out.receipt = String(it.Value);
            if (it.Name === 'PhoneNumber') out.phone = String(it.Value);
            if (it.Name === 'TransactionDate') out.transactionDate = String(it.Value);
        }
        return out;
    }
}
