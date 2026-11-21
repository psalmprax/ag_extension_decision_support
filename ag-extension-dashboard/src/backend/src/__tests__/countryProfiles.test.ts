import { phoneVariants, toE164, countryOfPhone } from '@/services/country/phone';
import { localDay, timeZoneFor, writesMonthFirst, zonedInstant } from '@/services/country/localTime';
import { parseSmsDate } from '@/services/sms/smsDate';
import { countryCoverage } from '@/services/country/countryCoverage';
import { COUNTRY_PROFILES, areaFromHectares, areaToHectares, findCountry, isValidTimeZone } from '@/shared-api/countries';

jest.mock('@/services/databaseService', () => ({ query: jest.fn() }));

describe('phone numbers are read in the farmer’s own country', () => {
    it('reads a local number in the given country', () => {
        expect(toE164('0712 345 678', 'Kenya')).toBe('+254712345678');
        expect(toE164('0803 123 4567', 'Nigeria')).toBe('+2348031234567');
        expect(toE164('0772 123 456', 'Uganda')).toBe('+256772123456');
        expect(toE164('0991 234 567', 'Malawi')).toBe('+265991234567');
    });

    it('keeps an international number as written, whatever the country', () => {
        expect(toE164('+234 803 123 4567', 'Kenya')).toBe('+2348031234567');
        expect(toE164('00256772123456', 'Kenya')).toBe('+256772123456');
    });

    it('accepts the country code without the plus, as gateways send it', () => {
        expect(toE164('254712345678', 'Kenya')).toBe('+254712345678');
    });

    it('never puts a Nigerian number on a Kenyan code', () => {
        expect(toE164('08031234567', 'Nigeria')).not.toMatch(/^\+254/);
    });

    it('refuses something that is not a phone number', () => {
        expect(toE164('12', 'Kenya')).toBeNull();
        expect(toE164('', 'Kenya')).toBeNull();
    });

    it('lists the stored forms of one number for matching', () => {
        expect(phoneVariants('+254712345678')).toEqual(expect.arrayContaining(['+254712345678', '254712345678', '0712345678']));
    });

    it('tells which country a number belongs to', () => {
        expect(countryOfPhone('+256772123456')).toBe('Uganda');
        expect(countryOfPhone('+2348031234567')).toBe('Nigeria');
    });
});

describe('country profiles', () => {
    it('have a valid currency, time zone and at least one language for every country', () => {
        for (const profile of COUNTRY_PROFILES) {
            expect(profile.currency).toMatch(/^[A-Z]{3}$/);
            expect(profile.timeZones.length).toBeGreaterThan(0);
            profile.timeZones.forEach(zone => expect(isValidTimeZone(zone)).toBe(true));
            expect(profile.languages.length).toBeGreaterThan(0);
        }
    });

    it('find a country by name or ISO code', () => {
        expect(findCountry('ng')?.name).toBe('Nigeria');
        expect(findCountry('United States')?.iso2).toBe('US');
        expect(findCountry('usa')?.iso2).toBe('US');
        expect(findCountry('Atlantis')).toBeNull();
    });

    it('convert land between hectares and acres', () => {
        expect(areaFromHectares(1, 'acre')).toBeCloseTo(2.471, 3);
        expect(areaToHectares(areaFromHectares(3.2, 'acre'), 'acre')).toBeCloseTo(3.2, 10);
    });
});

describe('time zones', () => {
    it('use the person’s own zone, else the country’s', () => {
        expect(timeZoneFor({ timeZone: 'Africa/Lagos', country: 'Kenya' })).toBe('Africa/Lagos');
        expect(timeZoneFor({ timeZone: 'Not/AZone', country: 'Malawi' })).toBe('Africa/Blantyre');
        expect(timeZoneFor({ country: 'India' })).toBe('Asia/Kolkata');
    });

    it('give the local wall-clock time as an instant', () => {
        expect(zonedInstant(2026, 10, 25, 9, 0, 'Africa/Nairobi').toISOString()).toBe('2026-11-25T06:00:00.000Z');
        expect(zonedInstant(2026, 6, 1, 9, 0, 'America/New_York').toISOString()).toBe('2026-07-01T13:00:00.000Z');
    });

    it('know the local day across midnight', () => {
        // 22:30 UTC is already the next day in Nairobi.
        expect(localDay(new Date('2026-11-24T22:30:00Z'), 'Africa/Nairobi').day).toBe(25);
    });
});

describe('dates typed by SMS', () => {
    const lateEvening = new Date('2026-11-24T22:30:00Z'); // 01:30 on the 25th in Nairobi

    it('means the sender’s today and tomorrow, at 09:00 their time', () => {
        expect(parseSmsDate('today', lateEvening, { timeZone: 'Africa/Nairobi' })?.date.toISOString()).toBe('2026-11-25T06:00:00.000Z');
        expect(parseSmsDate('kesho mbolea', lateEvening, { timeZone: 'Africa/Nairobi' })).toEqual({
            date: new Date('2026-11-26T06:00:00.000Z'),
            rest: 'mbolea',
        });
    });

    it('reads 11/25 month first where people write it that way', () => {
        expect(writesMonthFirst('United States')).toBe(true);
        expect(writesMonthFirst('Kenya')).toBe(false);
        const us = parseSmsDate('11/25', new Date('2026-11-20T12:00:00Z'), { timeZone: 'America/Chicago', monthFirst: true });
        expect(us?.date.toISOString()).toBe('2026-11-25T15:00:00.000Z');
        expect(parseSmsDate('11/25', new Date('2026-11-20T12:00:00Z'), { timeZone: 'Africa/Nairobi' })).toBeNull();
    });

    it('rejects a day that does not exist', () => {
        expect(parseSmsDate('31/02', new Date('2026-01-10T12:00:00Z'))).toBeNull();
    });
});

describe('what the product can serve in a country', () => {
    it('says Kenya has local market prices and Kiswahili SMS', () => {
        const kenya = countryCoverage(findCountry('Kenya')!);
        expect(kenya.prices).toBe('local_markets');
        expect(kenya.smsLanguages).toContain('sw');
        expect(kenya.supportLevel).toBe('full');
    });

    it('is honest about a country with no price source', () => {
        const fiji = countryCoverage(findCountry('Fiji')!);
        expect(fiji.prices).toBe('none');
        expect(fiji.supportLevel).toBe('basic');
    });
});
