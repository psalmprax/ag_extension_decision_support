import { nasaPowerService } from './src/services/data/nasaPowerService';

async function testNasaPower() {
    try {
        console.log('Testing NASA POWER API for Nairobi, Kenya (-1.286389, 36.817223)...');
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - 3);
        const formatString = (d: Date) => d.toISOString().split('T')[0].replace(/-/g, '');

        const data = await nasaPowerService.fetchMeteorologicalData({
            latitude: -1.286389,
            longitude: 36.817223,
            start: formatString(start),
            end: formatString(end)
        });
        
        console.log('Successfully received data.');
        console.log('Parameters found:', Object.keys(data.properties.parameter));
        
        // Print average temperature over the 3 days to verify parsing
        const temps = Object.values(data.properties.parameter.T2M) as number[];
        const avgTemp = temps.reduce((a, b) => a + b, 0) / temps.length;
        console.log(`Average Temperature (3 days): ${avgTemp.toFixed(2)} C`);

    } catch (error) {
        console.error('Test failed:', error);
    }
}

testNasaPower();
