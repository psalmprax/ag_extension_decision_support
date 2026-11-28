jest.mock('@/services/databaseService', () => ({ query: jest.fn() }));
jest.mock('@/services/notificationService', () => ({ notificationService: { send: jest.fn().mockResolvedValue(true) } }));
jest.mock('@/services/weatherService', () => ({ WeatherService: { getByCoordinates: jest.fn(), getByLocation: jest.fn() } }));
jest.mock('@/services/notify/farmerNotices', () => ({
    ...jest.requireActual('@/services/notify/farmerNotices'),
    sendFarmerNotice: jest.fn().mockResolvedValue('sent'),
}));

import { query } from '@/services/databaseService';
import { notificationService } from '@/services/notificationService';
import { WeatherService, type WeatherData } from '@/services/weatherService';
import { sendFarmerNotice, type NoticeVars } from '@/services/notify/farmerNotices';
import { noticeText } from '@/services/notify/noticeCopy';
import { checkSevereWeather, groupFarms, severeDays, type WeatherFarm } from '@/services/alerts/weatherAlerts';
import { deliverFarmerAlerts, noticeFor, withinWakingHours, type PendingDelivery } from '@/services/alerts/farmerAlertDelivery';

const mockQuery = query as jest.Mock;
const farm = (overrides: Partial<WeatherFarm> = {}): WeatherFarm => ({
    id: 'f1', tenant_id: 't1', location_lat: '-11.46', location_lng: '34.02', district: 'Mzimba', region: 'Northern Region', country: 'Malawi', ...overrides,
});
const forecast = (...days: Array<{ date: string; condition: string; precipitationMm?: number }>): WeatherData => ({
    temperature: 24, temp: 24, condition: 'Partly cloudy', humidity: 70, windSpeed: 10,
    forecast: days.map(day => ({ maxTemp: 28, minTemp: 17, ...day })),
});

beforeEach(() => {
    mockQuery.mockReset();
    jest.clearAllMocks();
    delete process.env.FARMER_ALERTS_ENABLED;
    delete process.env.FARMER_ALERTS_DAILY_CAP;
});

describe('severe weather in the forecast', () => {
    it('shares one forecast between farms in the same 11 km cell and tenant, not across tenants', () => {
        const groups = groupFarms([
            farm(),
            farm({ id: 'f2', location_lat: '-11.47', location_lng: '34.04' }),
            farm({ id: 'f3', tenant_id: 't2' }),
        ]);
        expect(groups.map(g => g.farmerIds)).toEqual([['f1', 'f2'], ['f3']]);
        expect(groups[0].point).toEqual({ lat: -11.5, lng: 34 });
    });

    it('looks a farm without coordinates up in its own country, not in Kenya', async () => {
        mockQuery
            .mockResolvedValueOnce({ rows: [farm({ location_lat: null, location_lng: null })] })
            .mockResolvedValue({ rows: [] });
        (WeatherService.getByLocation as jest.Mock).mockResolvedValue(forecast({ date: '2026-11-29', condition: 'Clear sky' }));
        await checkSevereWeather();
        expect(WeatherService.getByLocation).toHaveBeenCalledWith('Mzimba, Malawi');
        expect(WeatherService.getByCoordinates).not.toHaveBeenCalled();
    });

    it('takes today and tomorrow only, as the forecast classes them', () => {
        const days = severeDays(forecast(
            { date: '2026-11-28', condition: 'Moderate rain', precipitationMm: 9 },
            { date: '2026-11-29', condition: 'Heavy rain', precipitationMm: 41.6 },
            { date: '2026-11-30', condition: 'Thunderstorm with hail' },
        ));
        expect(days).toEqual([{ date: '2026-11-29', condition: 'Heavy rain', rainMm: 42 }]);
    });

    it('records one alert per area and day for farmers, and tells managers only when it is new', async () => {
        mockQuery
            .mockResolvedValueOnce({ rows: [farm(), farm({ id: 'f2' })] })
            .mockResolvedValueOnce({ rows: [{ id: 'alert-1' }] })
            .mockResolvedValueOnce({ rows: [{ id: 'manager-1' }] });
        (WeatherService.getByCoordinates as jest.Mock).mockResolvedValue(forecast({ date: '2026-11-29', condition: 'Heavy rain', precipitationMm: 40 }));
        await expect(checkSevereWeather()).resolves.toBe(1);
        expect(WeatherService.getByCoordinates).toHaveBeenCalledWith(-11.5, 34);
        const [sql, params] = mockQuery.mock.calls[1];
        expect(sql).toMatch(/ON CONFLICT \(dedupe_key\) DO NOTHING/);
        expect(params[4]).toEqual(['f1', 'f2']);
        expect(JSON.parse(params[8])).toEqual({ source: 'Open-Meteo', date: '2026-11-29', condition: 'Heavy rain', rainMm: 40 });
        expect(notificationService.send).toHaveBeenCalledWith(expect.objectContaining({ userId: 'manager-1', title: 'Heavy rain forecast for Mzimba on 2026-11-29' }));

        jest.clearAllMocks();
        mockQuery.mockReset()
            .mockResolvedValueOnce({ rows: [farm()] })
            .mockResolvedValueOnce({ rows: [] });
        await expect(checkSevereWeather()).resolves.toBe(0);
        expect(notificationService.send).not.toHaveBeenCalled();
    });
});

describe('alerts to farmers', () => {
    const delivery = (overrides: Partial<PendingDelivery> = {}): PendingDelivery => ({
        alert_id: 'a1', type: 'weather', title: 'Heavy rain forecast', farmer_id: 'f1', country: 'Malawi', sent_today: 0,
        details: { date: '2026-11-29', condition: 'Heavy rain', rainMm: 40 }, ...overrides,
    });
    const morning = new Date('2026-11-28T07:00:00Z'); // 09:00 in Malawi

    it('send nothing unless switched on, because every SMS is paid for', async () => {
        await expect(deliverFarmerAlerts(morning)).resolves.toBe(0);
        expect(mockQuery).not.toHaveBeenCalled();
    });

    it('claim the delivery before sending, so no farmer gets an alert twice', async () => {
        process.env.FARMER_ALERTS_ENABLED = 'true';
        mockQuery
            .mockResolvedValueOnce({ rows: [delivery()] })
            .mockResolvedValueOnce({ rows: [{ id: 'd1' }] })
            .mockResolvedValueOnce({ rows: [] });
        await expect(deliverFarmerAlerts(morning)).resolves.toBe(1);
        expect(mockQuery.mock.calls[1][0]).toMatch(/INSERT INTO alert_deliveries[\s\S]*ON CONFLICT/);
        expect(sendFarmerNotice).toHaveBeenCalledWith('f1', 'weather_warning_rain', expect.any(Function));
        expect(mockQuery.mock.calls[2][1]).toEqual(['sent', 'd1']);
    });

    it('wait for daytime where the farmer lives, and stop at the daily cap', async () => {
        process.env.FARMER_ALERTS_ENABLED = 'true';
        process.env.FARMER_ALERTS_DAILY_CAP = '1';
        expect(withinWakingHours(new Date('2026-11-28T19:30:00Z'), 'Malawi')).toBe(false); // 21:30 in Malawi
        mockQuery.mockResolvedValueOnce({ rows: [delivery()] });
        await expect(deliverFarmerAlerts(new Date('2026-11-28T19:30:00Z'))).resolves.toBe(0);

        mockQuery.mockReset()
            .mockResolvedValueOnce({ rows: [delivery(), delivery({ alert_id: 'a2' })] })
            .mockResolvedValueOnce({ rows: [{ id: 'd1' }] })
            .mockResolvedValueOnce({ rows: [] });
        await expect(deliverFarmerAlerts(morning)).resolves.toBe(1);
        expect(sendFarmerNotice).toHaveBeenCalledTimes(1);
    });

    it('state the forecast in the farmer’s language and calendar', () => {
        const { key, vars } = noticeFor(delivery());
        const words = (vars as Exclude<NoticeVars, Record<string, string>>)({ language: 'sw', country: 'Kenya' });
        expect(noticeText(key, 'sw', words)).toMatch(/^Tahadhari ya hali ya hewa kwa shamba lako tarehe .*29.*: mvua kubwa, takriban mm 40 za mvua \(utabiri wa Open-Meteo\)/);
    });

    it('carry an officer’s alert in the officer’s name', () => {
        const { key, vars } = noticeFor(delivery({ type: 'pest', title: 'Fall armyworm seen in Ekwendeni', details: { officerName: 'Daniel Banda' } }));
        expect(noticeText(key, 'en', vars as Record<string, string>)).toBe(
            'Alert from Daniel Banda: Fall armyworm seen in Ekwendeni. Reply here to ask about it. Reply STOP to stop notices.',
        );
    });
});
