import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion, AnimatePresence } from 'framer-motion';
import { farmerSchema, type FarmerInput } from '@/lib/schemas';
import { useAppStore } from '@/store/useAppStore';
import { useDemoMode } from '@/demo';
import {
  UserPlus,
  MapPin,
  Phone,
  Maximize,
  Activity,
  Lock,
  Sparkles,
  Layers,
  Globe,
  Radio,
  Plus,
  X,
  CheckCircle2,
  AlertCircle,
  Compass,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '@/lib/LanguageContext';
import { createFarmer } from '@/api/farmerService';

const COMMON_CROPS = [
  'Maize',
  'Coffee',
  'Cassava',
  'Rice',
  'Tea',
  'Beans',
  'Tomato',
  'Potato',
  'Sorghum',
  'Wheat',
  'Avocado',
  'Bananas',
];

const ONBOARDING_PRESETS = [
  {
    name: 'Smallholder Maize',
    icon: '🌽',
    crops: ['Maize', 'Beans'],
    location: 'Nakuru, Rift Valley',
    farmSize: 2.5,
    vitalScore: 88,
    lat: -0.3031,
    lng: 36.0800,
    lang: 'sw',
  },
  {
    name: 'Highland Coffee & Tea',
    icon: '☕',
    crops: ['Coffee', 'Tea'],
    location: 'Kiambu, Central',
    farmSize: 4.8,
    vitalScore: 78,
    lat: -1.1714,
    lng: 36.8356,
    lang: 'en',
  },
  {
    name: 'Irrigation Rice Co-op',
    icon: '🌾',
    crops: ['Rice', 'Tomato'],
    location: 'Mwea, Kirinyaga',
    farmSize: 12.0,
    vitalScore: 92,
    lat: -0.6591,
    lng: 37.3582,
    lang: 'en',
  },
];

export const FarmerRegistrationForm: React.FC = () => {
  const { addFarmer, isLoading, setLoading } = useAppStore();
  const { t } = useLanguage();
  const { isDemo } = useDemoMode();

  const [selectedCrops, setSelectedCrops] = useState<string[]>(['Maize']);
  const [customCropInput, setCustomCropInput] = useState('');
  const [isDetectingGps, setIsDetectingGps] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FarmerInput>({
    resolver: zodResolver(farmerSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      phone: '',
      location: '',
      languagePreference: 'en',
      crops: ['Maize'],
      farmSize: 2.5,
      latitude: undefined,
      longitude: undefined,
      vitalScore: 85,
    },
  });

  const currentVitalScore = watch('vitalScore') ?? 85;
  const currentLatitude = watch('latitude');
  const currentLongitude = watch('longitude');

  const toggleCrop = (crop: string) => {
    let next: string[];
    if (selectedCrops.includes(crop)) {
      next = selectedCrops.filter(c => c !== crop);
    } else {
      next = [...selectedCrops, crop];
    }
    setSelectedCrops(next);
    setValue('crops', next, { shouldValidate: true });
  };

  const addCustomCrop = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customCropInput.trim();
    if (trimmed && !selectedCrops.includes(trimmed)) {
      const next = [...selectedCrops, trimmed];
      setSelectedCrops(next);
      setValue('crops', next, { shouldValidate: true });
      setCustomCropInput('');
    }
  };

  const applyPreset = (preset: typeof ONBOARDING_PRESETS[0]) => {
    setValue('crops', preset.crops, { shouldValidate: true });
    setSelectedCrops(preset.crops);
    setValue('location', preset.location, { shouldValidate: true });
    setValue('farmSize', preset.farmSize, { shouldValidate: true });
    setValue('vitalScore', preset.vitalScore, { shouldValidate: true });
    setValue('latitude', preset.lat, { shouldValidate: true });
    setValue('longitude', preset.lng, { shouldValidate: true });
    setValue('languagePreference', preset.lang, { shouldValidate: true });
    toast.success(`Preset "${preset.name}" loaded!`);
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }
    setIsDetectingGps(true);
    navigator.geolocation.getCurrentPosition(
      position => {
        const { latitude, longitude } = position.coords;
        setValue('latitude', parseFloat(latitude.toFixed(6)), { shouldValidate: true });
        setValue('longitude', parseFloat(longitude.toFixed(6)), { shouldValidate: true });
        setIsDetectingGps(false);
        toast.success('GPS coordinates detected with high accuracy!');
      },
      error => {
        setIsDetectingGps(false);
        toast.error('Failed to get location: ' + error.message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const onSubmit = async (data: FarmerInput) => {
    setLoading(true);
    try {
      const response = await createFarmer({
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        region: data.location,
        village: data.location,
        crops: selectedCrops.length > 0 ? selectedCrops : ['Maize'],
        farmSize: data.farmSize || 0,
        locationLat: data.latitude,
        locationLng: data.longitude,
        vitalScore: data.vitalScore,
      });

      if (response.success) {
        addFarmer({
          id: response.data.id,
          firstName: response.data.firstName,
          lastName: response.data.lastName,
          phone: response.data.phone || '',
          location: data.location,
          crops: response.data.crops,
          farmSize: response.data.farmSize,
          latitude: response.data.locationLat,
          longitude: response.data.locationLng,
        });
        toast.success(t('farmer_register_success') || 'Farmer client registered successfully!');
        reset();
        setSelectedCrops(['Maize']);
      }
    } catch (error) {
      toast.error(t('farmer_register_failed') || 'Failed to register client');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (isDemo) {
    return (
      <div className="max-w-3xl mx-auto p-8 backdrop-blur-xl bg-slate-900/60 border border-white/10 rounded-2xl shadow-2xl text-center relative overflow-hidden">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <Lock className="w-8 h-8 text-amber-400" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-white mb-2">Register Client</h2>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Interactive Preview Mode</span>
        </div>
        <p className="text-slate-400 text-sm max-w-md mx-auto">
          Farmer registration is simulated in sandbox demo mode. Sign in to an active tenant account to enroll live farmers into the agricultural telemetry mesh.
        </p>
      </div>
    );
  }

  const getVitalScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
    if (score >= 65) return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
    return 'text-rose-400 border-rose-500/30 bg-rose-500/10';
  };

  const getVitalScoreLabel = (score: number) => {
    if (score >= 80) return 'Optimal Baseline';
    if (score >= 65) return 'Moderate Monitoring';
    return 'Priority Queue Required (<65)';
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* ── Top Bento Banner: Fast-Fill Presets & Node Telemetry ── */}
      <div className="backdrop-blur-xl bg-slate-900/60 border border-white/10 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-950/40">
              <UserPlus className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-white">Register Client</h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xxs font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  <Radio className="w-2.5 h-2.5 text-emerald-400 animate-pulse" />
                  Edge Intake Node
                </span>
              </div>
              <p className="text-xs text-white/60 mt-0.5">
                Enroll smallholders into real-time advisory pipelines, NASA POWER weather radar, and autonomous SMS/WhatsApp campaigns.
              </p>
            </div>
          </div>

          {/* Quick-Fill Agronomic Presets */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xxs font-semibold text-white/40 uppercase tracking-wider">Quick Fill:</span>
            {ONBOARDING_PRESETS.map(p => (
              <button
                key={p.name}
                type="button"
                onClick={() => applyPreset(p)}
                className="px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-emerald-500/15 border border-white/10 hover:border-emerald-500/30 text-xs text-white/80 hover:text-white transition-all flex items-center gap-1.5 shadow-sm"
              >
                <span>{p.icon}</span>
                <span className="font-medium">{p.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main Bento Grid Form ── */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card 1: Identity & Multi-Channel Contact Profile */}
          <div className="backdrop-blur-xl bg-slate-900/60 border border-white/10 rounded-2xl p-6 space-y-5 shadow-lg">
            <div className="flex items-center gap-2.5 pb-2 border-b border-white/5">
              <UserPlus className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-white">Identity & Communication Profile</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-white/70 uppercase tracking-wide">
                  {t('farmer_register_first_name') || 'First Name'} *
                </label>
                <input
                  {...register('firstName')}
                  placeholder="e.g. Samuel"
                  className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/[0.03] text-white placeholder-white/25 focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition-all outline-none text-sm"
                />
                {errors.firstName && (
                  <p className="text-xs text-rose-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {errors.firstName.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-white/70 uppercase tracking-wide">
                  {t('farmer_register_last_name') || 'Last Name'} *
                </label>
                <input
                  {...register('lastName')}
                  placeholder="e.g. Kiprono"
                  className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/[0.03] text-white placeholder-white/25 focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition-all outline-none text-sm"
                />
                {errors.lastName && (
                  <p className="text-xs text-rose-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {errors.lastName.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-white/70 uppercase tracking-wide">
                  {t('farmer_register_phone') || 'Mobile Phone (E.164)'} *
                </label>
                <div className="flex items-center gap-1.5 text-xxs text-white/40">
                  <span className="px-1.5 py-0.5 rounded bg-white/[0.05] border border-white/10">SMS</span>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">WhatsApp</span>
                  <span className="px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">Telegram</span>
                </div>
              </div>
              <div className="relative">
                <Phone className="w-4 h-4 text-white/40 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  {...register('phone')}
                  placeholder="+254 712 345 678"
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-white/10 bg-white/[0.03] text-white placeholder-white/25 focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition-all outline-none text-sm font-mono"
                />
              </div>
              {errors.phone && (
                <p className="text-xs text-rose-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {errors.phone.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-white/70 uppercase tracking-wide">
                  {t('farmer_register_location') || 'District / Region'} *
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-white/40 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    {...register('location')}
                    placeholder="e.g. Nakuru, Rongai"
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-white/10 bg-white/[0.03] text-white placeholder-white/25 focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition-all outline-none text-sm"
                  />
                </div>
                {errors.location && (
                  <p className="text-xs text-rose-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {errors.location.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-white/70 uppercase tracking-wide">
                  {t('farmers_language') || 'Advisory Language'}
                </label>
                <div className="relative">
                  <Globe className="w-4 h-4 text-white/40 absolute left-4 top-1/2 -translate-y-1/2" />
                  <select
                    {...register('languagePreference')}
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-white/10 bg-slate-900 text-white focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition-all outline-none text-sm"
                  >
                    <option value="en">English (en)</option>
                    <option value="sw">Kiswahili (sw)</option>
                    <option value="lug">Luganda (lug)</option>
                    <option value="ny">Chichewa (ny)</option>
                    <option value="am">Amharic (am)</option>
                    <option value="oro">Afaan Oromoo (oro)</option>
                    <option value="fr">Français (fr)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Agronomic Portfolio & Land Parcel */}
          <div className="backdrop-blur-xl bg-slate-900/60 border border-white/10 rounded-2xl p-6 space-y-5 shadow-lg">
            <div className="flex items-center gap-2.5 pb-2 border-b border-white/5">
              <Layers className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-white">Agronomic Portfolio & Parcel</h2>
            </div>

            {/* Multi-Crop Tag Chips */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-white/70 uppercase tracking-wide">
                  Cultivated Crops ({selectedCrops.length} selected)
                </label>
                <span className="text-xxs text-white/40">Click chips to toggle</span>
              </div>

              <div className="flex flex-wrap gap-2">
                {COMMON_CROPS.map(crop => {
                  const isSelected = selectedCrops.includes(crop);
                  return (
                    <button
                      key={crop}
                      type="button"
                      onClick={() => toggleCrop(crop)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 border ${
                        isSelected
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-950/30'
                          : 'bg-white/[0.03] text-white/60 border-white/5 hover:border-white/15 hover:text-white'
                      }`}
                    >
                      {isSelected && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                      <span>{crop}</span>
                    </button>
                  );
                })}
              </div>

              {/* Custom Crop Addition */}
              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  value={customCropInput}
                  onChange={e => setCustomCropInput(e.target.value)}
                  placeholder="Add custom crop..."
                  className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-white/10 bg-white/[0.02] text-white placeholder-white/30 focus:ring-1 focus:ring-emerald-400 outline-none"
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCustomCrop(e);
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={addCustomCrop}
                  className="px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-emerald-500/20 border border-white/10 text-xs font-semibold text-white flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>
            </div>

            {/* Farm Size */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-white/70 uppercase tracking-wide">
                  {t('farmer_register_farm_size') || 'Estimated Land Holding'}
                </label>
                <div className="flex items-center gap-1.5">
                  {['1.0', '2.5', '5.0', '10.0'].map(sz => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => setValue('farmSize', parseFloat(sz), { shouldValidate: true })}
                      className="px-2 py-0.5 rounded-lg text-xxs font-mono bg-white/[0.04] hover:bg-emerald-500/15 border border-white/5 text-white/60 hover:text-emerald-300 transition-colors"
                    >
                      {sz} ha
                    </button>
                  ))}
                </div>
              </div>
              <div className="relative">
                <Maximize className="w-4 h-4 text-white/40 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  step="0.1"
                  {...register('farmSize', { valueAsNumber: true })}
                  placeholder="2.5"
                  className="w-full pl-11 pr-16 py-3 rounded-xl border border-white/10 bg-white/[0.03] text-white placeholder-white/25 focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition-all outline-none text-sm font-mono"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-white/40 uppercase">
                  Hectares
                </span>
              </div>
              {errors.farmSize && (
                <p className="text-xs text-rose-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {errors.farmSize.message}
                </p>
              )}
            </div>
          </div>

          {/* Card 3: Geolocation Coordinates & NASA POWER Radar */}
          <div className="backdrop-blur-xl bg-slate-900/60 border border-white/10 rounded-2xl p-6 space-y-5 shadow-lg">
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <div className="flex items-center gap-2.5">
                <Compass className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-white">Geospatial Telemetry</h2>
              </div>
              <button
                type="button"
                onClick={handleDetectLocation}
                disabled={isDetectingGps}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-xs font-semibold text-emerald-300 transition-all shadow-sm"
              >
                <Compass className={`w-3.5 h-3.5 ${isDetectingGps ? 'animate-spin' : ''}`} />
                <span>{isDetectingGps ? 'Detecting...' : 'Detect GPS'}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-white/70 uppercase tracking-wide">
                  Latitude
                </label>
                <input
                  type="number"
                  step="0.000001"
                  {...register('latitude', { valueAsNumber: true })}
                  placeholder="-0.303099"
                  className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/[0.03] text-white placeholder-white/25 focus:ring-2 focus:ring-emerald-400 outline-none text-sm font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-white/70 uppercase tracking-wide">
                  Longitude
                </label>
                <input
                  type="number"
                  step="0.000001"
                  {...register('longitude', { valueAsNumber: true })}
                  placeholder="36.080025"
                  className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/[0.03] text-white placeholder-white/25 focus:ring-2 focus:ring-emerald-400 outline-none text-sm font-mono"
                />
              </div>
            </div>

            {/* Satellite Telemetry Preview Card */}
            {currentLatitude && currentLongitude ? (
              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-xxs">
                  <span className="font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Radio className="w-3 h-3 animate-pulse text-emerald-400" />
                    Auto-Linked Earth Observation
                  </span>
                  <span className="text-white/40 font-mono">NASA POWER / SoilGrids</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 rounded-lg bg-white/[0.02] border border-white/5">
                    <div className="text-xxs text-white/40">Estimated pH</div>
                    <div className="font-bold text-white mt-0.5">6.2 (Optimal)</div>
                  </div>
                  <div className="p-2 rounded-lg bg-white/[0.02] border border-white/5">
                    <div className="text-xxs text-white/40">Rainfall Risk</div>
                    <div className="font-bold text-emerald-400 mt-0.5">Low (+18mm)</div>
                  </div>
                  <div className="p-2 rounded-lg bg-white/[0.02] border border-white/5">
                    <div className="text-xxs text-white/40">Solar Rad</div>
                    <div className="font-bold text-amber-300 mt-0.5">21.4 MJ/m²</div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xxs text-white/40 leading-relaxed italic">
                Coordinates are optional. Adding GPS coordinates connects this farm to high-resolution NDVI vegetation indices and hyper-local precipitation forecasts.
              </p>
            )}
          </div>

          {/* Card 4: Initial Vital Score & Agronomic Health Tier */}
          <div className="backdrop-blur-xl bg-slate-900/60 border border-white/10 rounded-2xl p-6 space-y-5 shadow-lg">
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <div className="flex items-center gap-2.5">
                <Activity className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-white">Vital Score Baseline</h2>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getVitalScoreColor(currentVitalScore)}`}>
                {currentVitalScore}/100 • {getVitalScoreLabel(currentVitalScore)}
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-white/60 font-medium">
                <span>Critical Risk (&lt;65)</span>
                <span>Moderate (65–79)</span>
                <span>Optimal (80–100)</span>
              </div>
              <input
                type="range"
                min="30"
                max="100"
                step="1"
                {...register('vitalScore', { valueAsNumber: true })}
                className="w-full h-2 rounded-lg bg-slate-800 appearance-none cursor-pointer accent-emerald-400"
              />
            </div>

            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/10 text-xs text-white/70 space-y-1">
              <div className="font-semibold text-white">Dynamic Workflow Dispatch:</div>
              <p className="text-xxs leading-relaxed text-white/50">
                Farmers registered with a Vital Score below <strong className="text-rose-400">65</strong> are instantly queued for priority on-site field visits and flagged in the extension officer dispatch roster.
              </p>
            </div>
          </div>
        </div>

        {/* ── Floating Submit Action Bar ── */}
        <div className="backdrop-blur-xl bg-slate-900/80 border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-2xl">
          <div className="flex items-center gap-2 text-xs text-white/60">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>Ready to activate real-time advisory profile & automated onboarding sync.</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => {
                reset();
                setSelectedCrops(['Maize']);
              }}
              className="px-5 py-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] text-xs font-semibold text-white/70 hover:text-white transition-colors border border-white/10"
            >
              Reset Form
            </button>

            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 sm:flex-initial px-8 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-xl shadow-emerald-950/50 flex items-center justify-center gap-2 text-sm"
            >
              <UserPlus className="w-4 h-4" />
              <span>{isLoading ? 'Enrolling Client...' : 'Enroll Farmer Client'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default FarmerRegistrationForm;
