import { useState, useEffect } from 'react';
import { Droplets, ThermometerSun, Leaf, AlertTriangle, Loader2, CheckCircle2 } from 'lucide-react';
import { fetchFarmers, fetchFarmerStats, Farmer, FarmerStats } from '@/api/farmerService';
import { fetchWeather } from '@/api/weatherService';

interface WeatherData {
  location?: string;
  temp_c?: number;
  condition?: { text: string };
  precip_mm?: number;
}

export const FarmerMobileSummary = () => {
  const [farmer, setFarmer] = useState<Farmer | null>(null);
  const [stats, setStats] = useState<FarmerStats | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        // Fetch first available farmer for the summary prototype
        const farmersRes = await fetchFarmers();
        if (farmersRes.success && farmersRes.data.farmers.length > 0) {
          const currentFarmer = farmersRes.data.farmers[0];
          setFarmer(currentFarmer);

          // Fetch weather based on farmer's region (or default to Nairobi)
          const location = currentFarmer.region || 'Nairobi';
          const weatherRes = await fetchWeather(location);
          if (weatherRes.success) setWeather(weatherRes.data);
        }

        // Fetch global/farmer stats
        const statsRes = await fetchFarmerStats();
        if (statsRes.success) {
          setStats(statsRes.data);
        }
      } catch (e) {
        console.error('Failed to load farmer mobile summary data', e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary-500" />
      </div>
    );
  }

  if (!farmer) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-6 text-center text-gray-500">
        No farmer profile found. Please register a farmer first.
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto bg-gray-50 dark:bg-gray-900 min-h-screen text-gray-800 dark:text-gray-100 font-sans pb-8">
      {/* Header */}
      <header className="bg-primary-600 text-white p-6 rounded-b-3xl shadow-lg">
        <h1 className="text-2xl font-bold tracking-tight">Farm Overview</h1>
        <p className="text-primary-100 mt-1">Hello, {farmer.firstName}! Here is your daily summary.</p>
      </header>

      {/* Main Content */}
      <main className="p-4 space-y-4">
        {/* Weather Snapshot */}
        <section className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-100 text-orange-600 rounded-full">
              <ThermometerSun size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{weather?.location || farmer.region || 'Local'} Weather</p>
              <p className="text-lg font-bold">{weather?.temp_c ? `${weather.temp_c}°C` : stats?.avgTemp || '28°C'} / {weather?.condition?.text || 'Clear'}</p>
            </div>
          </div>
          <div className="text-right text-sm">
            <span className="block text-gray-500 dark:text-gray-400">Precip</span>
            <span className="font-bold text-blue-500">{weather?.precip_mm ? `${weather.precip_mm}mm` : '10%'}</span>
          </div>
        </section>

        {/* Soil & Crop Health */}
        <section className="grid grid-cols-2 gap-4">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <Droplets size={18} className="text-blue-500" />
              <h3 className="font-semibold text-sm">Soil Moisture</h3>
            </div>
            <p className="text-2xl font-bold text-gray-800 dark:text-white">{stats?.soilMoisture || '42%'}</p>
            <p className="text-xs text-green-500 mt-1">Optimal Level</p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <Leaf size={18} className="text-green-500" />
              <h3 className="font-semibold text-sm">Crop Health</h3>
            </div>
            <p className="text-2xl font-bold text-gray-800 dark:text-white">{stats?.vitalScore ? `${stats.vitalScore}/100` : 'Good'}</p>
            <p className="text-xs text-green-500 mt-1">NDVI: 0.75</p>
          </div>
        </section>

        {/* Alerts & Advisories */}
        {stats?.alertsCount ? (
          <section className="bg-red-50 dark:bg-red-900/20 p-4 rounded-2xl border border-red-100 dark:border-red-800/50">
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="text-red-500 mt-0.5 shrink-0" />
              <div>
                <h3 className="font-bold text-red-800 dark:text-red-400">Action Required</h3>
                <p className="text-sm text-red-600 dark:text-red-300 mt-1">
                  You have {stats.alertsCount} active alerts requiring attention today.
                </p>
              </div>
            </div>
          </section>
        ) : (
          <section className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-800/50">
            <div className="flex items-start gap-3">
              <CheckCircle2 size={20} className="text-emerald-500 mt-0.5 shrink-0" />
              <div>
                <h3 className="font-bold text-emerald-800 dark:text-emerald-400">All Clear</h3>
                <p className="text-sm text-emerald-600 dark:text-emerald-300 mt-1">
                  No critical pests or diseases reported in your immediate vicinity.
                </p>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
};
