import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
  Layers,
  Globe,
  Radio,
  Plus,
  CheckCircle2,
  AlertCircle,
  Compass,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '@/lib/LanguageContext';
import { isActionEnter } from '@/lib/keyboard';
import { createFarmer } from '@/api/farmerService';
import { InlinePrompt, InfoPromptIcon } from '@/components/ui/InfoPrompt';
import { COMMON_CROPS } from './farmerFormPresets';
import { AssignOfficerField } from './AssignOfficerField';
import { StaffRegionNote } from './StaffRegionNote';
import { getApiErrorMessage } from '@/lib/apiError';
import { useUnits } from '@/hooks/useUnits';
import { PageHeader } from '@/components/ui/PageHeader';

// Coordinates are optional: a blank number input must mean "not given", not NaN
// (which failed validation silently and blocked registration without GPS).
const optionalNumber = (value: unknown) =>
  value === '' || value === null || value === undefined ? undefined : Number(value);

export const FarmerRegistrationForm: React.FC = () => {
  const { addFarmer, isLoading, setLoading, user } = useAppStore();
  // Admins and regional managers choose the officer; an officer's farmers are their own.
  const canChooseOfficer = user?.role === 'admin' || user?.role === 'regional_manager';
  // Officers and regional managers register farmers in their own region (the server
  // enforces it). '' = a manager with no region on file, who cannot register yet;
  // null = no fixed region (admins, and officers with no region on file).
  const staffRegion = user?.role === 'regional_manager'
    ? user.region || ''
    : user?.role === 'extension_officer' && user.region ? user.region : null;
  const [assignedOfficerId, setAssignedOfficerId] = useState('');
  const { t } = useLanguage();
  const units = useUnits();
  const { isDemo } = useDemoMode();

  const [selectedCrops, setSelectedCrops] = useState<string[]>([]);
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
      crops: [],
      farmSize: undefined,
      latitude: undefined,
      longitude: undefined,
      vitalScore: undefined,
    },
  });

  // The officer's own assessment: nothing is recorded until they set it.
  const assessedVitalScore = watch('vitalScore');
  const currentVitalScore = assessedVitalScore ?? 70;
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
        region: staffRegion ?? data.location,
        village: data.location,
        assignedOfficerId: canChooseOfficer && assignedOfficerId ? assignedOfficerId : undefined,
        crops: selectedCrops,
        farmSize: units.toHectares(data.farmSize ?? 0), // typed in the person's unit; stored in hectares
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
          assignedOfficerId: response.data.assignedOfficerId,
        });
        toast.success(t('farmer_register_success') || 'Farmer client registered successfully!');
        reset();
        setSelectedCrops([]);
        setAssignedOfficerId('');
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('farmer_register_failed') || 'Failed to register client'));
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (isDemo) {
    return (
      <div className="max-w-3xl mx-auto p-8 backdrop-blur-xl bg-slate-50 dark:bg-theme-bg-secondary border border-slate-900/[0.08] dark:border-white/[0.08] rounded-xl shadow-2xl text-center relative overflow-hidden">
        <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <Lock className="w-6 h-6 text-amber-800 dark:text-amber-300" />
        </div>
        <h2 className="text-xl font-medium tracking-tight text-slate-900 dark:text-theme-text-primary mb-2">{t('nav_register_farmer')}</h2>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs font-medium mb-3">
          <Layers className="w-3.5 h-3.5" />
          <span>{t('ui_farmer_registration_form_interactive_preview_mode')}</span>
        </div>
        <p className="text-slate-600 dark:text-theme-text-muted text-sm max-w-md mx-auto">
          {t('ui_farmer_registration_form_farmer_registration_is_simulated_in')}
        </p>
      </div>
    );
  }

  const getVitalScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-700 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
    if (score >= 65) return 'text-amber-800 dark:text-amber-300 border-amber-500/30 bg-amber-500/10';
    return 'text-rose-700 dark:text-rose-400 border-rose-500/30 bg-rose-500/10';
  };

  const getVitalScoreLabel = (score: number) => {
    if (score >= 80) return 'Optimal Baseline';
    if (score >= 65) return 'Moderate Monitoring';
    return 'Priority Queue Required (<65)';
  };

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        photo="officerWithFarmer"
        title={t('nav_register_farmer')}
        description={t('register_farmer_desc', { defaultValue: 'Add a farmer so you can send them advice, plan visits and keep their field records.' })}
      />

      {/* Field Onboarding Contextual Prompt */}
      <InlinePrompt
        title={t('register_farmer_tip_title', { defaultValue: 'Registering a farmer' })}
        variant="tip"
        dismissible
        enableAudio
      >
        {t('ui_farmer_registration_form_farmers_registered_in_your_assigned')}
      </InlinePrompt>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card 1: Identity & Multi-Channel Contact Profile */}
          <div className="backdrop-blur-xl bg-slate-50 dark:bg-theme-bg-secondary border border-slate-900/[0.08] dark:border-white/[0.08] rounded-xl p-6 space-y-5 shadow-lg">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-900/[0.08] dark:border-white/[0.08]">
              <UserPlus className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              <h2 className="text-sm font-medium text-slate-900 dark:text-theme-text-primary">{t('ui_farmer_registration_form_identity_communication_profile')}</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-700 dark:text-theme-text-secondary">
                  {t('farmer_register_first_name') || 'First name'} *
                </label>
                <input
                  {...register('firstName')}
                  placeholder="First name"
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-900/[0.08] dark:border-white/[0.08] bg-slate-900/[0.03] dark:bg-white/[0.04] text-slate-900 dark:text-theme-text-primary placeholder-white/25 focus:ring-1 focus:ring-emerald-400 focus:border-transparent transition-colors outline-none text-sm"
                />
                {errors.firstName && (
                  <p className="text-xs text-rose-700 dark:text-rose-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {errors.firstName.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-700 dark:text-theme-text-secondary">
                  {t('farmer_register_last_name') || 'Last name'} *
                </label>
                <input
                  {...register('lastName')}
                  placeholder="Last name"
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-900/[0.08] dark:border-white/[0.08] bg-slate-900/[0.03] dark:bg-white/[0.04] text-slate-900 dark:text-theme-text-primary placeholder-white/25 focus:ring-1 focus:ring-emerald-400 focus:border-transparent transition-colors outline-none text-sm"
                />
                {errors.lastName && (
                  <p className="text-xs text-rose-700 dark:text-rose-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {errors.lastName.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-slate-700 dark:text-theme-text-secondary">
                  {t('farmer_register_phone') || 'Mobile Phone (E.164)'} *
                </label>
                <div className="flex items-center gap-1.5 text-xxs text-slate-600 dark:text-theme-text-muted">
                  <span className="px-1.5 py-0.5 rounded bg-slate-900/[0.03] dark:bg-white/[0.04] border border-slate-900/[0.08] dark:border-white/[0.08]">SMS</span>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">{t('ui_farmer_registration_form_whatsapp')}</span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-500/10 text-slate-600 dark:text-theme-text-muted border border-slate-500/20">{t('ui_farmer_registration_form_telegram')}</span>
                </div>
              </div>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-600 dark:text-theme-text-muted absolute start-4 top-1/2 -translate-y-1/2" />
                <input
                  {...register('phone')}
                  placeholder="+ country code and number"
                  className="w-full ps-11 pe-4 py-2.5 rounded-lg border border-slate-900/[0.08] dark:border-white/[0.08] bg-slate-900/[0.03] dark:bg-white/[0.04] text-slate-900 dark:text-theme-text-primary placeholder-white/25 focus:ring-1 focus:ring-emerald-400 focus:border-transparent transition-colors outline-none text-sm font-mono tabular-nums"
                />
              </div>
              {errors.phone && (
                <p className="text-xs text-rose-700 dark:text-rose-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {errors.phone.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-700 dark:text-theme-text-secondary">
                  {t('farmer_register_location') || 'District / Region'} *
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-600 dark:text-theme-text-muted absolute start-4 top-1/2 -translate-y-1/2" />
                  <input
                    {...register('location')}
                    placeholder="Village or ward"
                    className="w-full ps-11 pe-4 py-2.5 rounded-lg border border-slate-900/[0.08] dark:border-white/[0.08] bg-slate-900/[0.03] dark:bg-white/[0.04] text-slate-900 dark:text-theme-text-primary placeholder-white/25 focus:ring-1 focus:ring-emerald-400 focus:border-transparent transition-colors outline-none text-sm"
                  />
                </div>
                {errors.location && (
                  <p className="text-xs text-rose-700 dark:text-rose-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {errors.location.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-700 dark:text-theme-text-secondary">
                  {t('farmers_language') || 'Advisory Language'}
                </label>
                <div className="relative">
                  <Globe className="w-4 h-4 text-slate-600 dark:text-theme-text-muted absolute start-4 top-1/2 -translate-y-1/2" />
                  <select
                    {...register('languagePreference')}
                    className="w-full ps-11 pe-4 py-2.5 rounded-lg border border-slate-900/[0.08] dark:border-white/[0.08] bg-slate-50 dark:bg-theme-bg-secondary text-slate-900 dark:text-theme-text-primary focus:ring-1 focus:ring-emerald-400 focus:border-transparent transition-colors outline-none text-sm"
                  >
                    <option value="en">{t('ui_farmer_registration_form_english_en')}</option>
                    <option value="sw">{t('ui_farmer_registration_form_kiswahili_sw')}</option>
                    <option value="lug">{t('ui_farmer_registration_form_luganda_lug')}</option>
                    <option value="ny">{t('ui_farmer_registration_form_chichewa_ny')}</option>
                    <option value="am">{t('ui_farmer_registration_form_amharic_am')}</option>
                    <option value="oro">{t('ui_farmer_registration_form_afaan_oromoo_oro')}</option>
                    <option value="fr">{t('ui_farmer_registration_form_franc_ais_fr')}</option>
                  </select>
                </div>
              </div>
            </div>

            {canChooseOfficer && (
              <AssignOfficerField value={assignedOfficerId} onChange={setAssignedOfficerId} />
            )}
            <StaffRegionNote region={staffRegion} />
          </div>

          {/* Card 2: Agronomic Portfolio & Land Parcel */}
          <div className="backdrop-blur-xl bg-slate-50 dark:bg-theme-bg-secondary border border-slate-900/[0.08] dark:border-white/[0.08] rounded-xl p-6 space-y-5 shadow-sm">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-900/[0.08] dark:border-white/[0.08]">
              <Layers className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              <h2 className="text-sm font-medium text-slate-900 dark:text-theme-text-primary">{t('ui_farmer_registration_form_agronomic_portfolio_parcel')}</h2>
            </div>

            {/* Multi-Crop Tag Chips */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-slate-700 dark:text-theme-text-secondary">
                  {t('ui_farmer_registration_form_cultivated_crops_selected', { length: selectedCrops.length })}
                </label>
                <span className="text-xxs text-slate-600 dark:text-theme-text-muted">{t('ui_farmer_registration_form_click_chips_to_toggle')}</span>
              </div>

              <div className="flex flex-wrap gap-2">
                {COMMON_CROPS.map(crop => {
                  const isSelected = selectedCrops.includes(crop);
                  return (
                    <button
                      key={crop}
                      type="button"
                      onClick={() => toggleCrop(crop)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 border ${
                        isSelected
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-white/[0.03] text-white/60 border-white/5 hover:border-white/15 hover:text-white'
                      }`}
                    >
                      {isSelected && <CheckCircle2 className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />}
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
                  placeholder="Add another crop"
                  className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-900/[0.08] dark:border-white/[0.08] bg-slate-900/[0.03] dark:bg-white/[0.04] text-slate-900 dark:text-theme-text-primary placeholder-white/30 focus:ring-1 focus:ring-emerald-400 outline-none"
                  onKeyDown={e => isActionEnter(e) && addCustomCrop(e)}
                />
                <button
                  type="button"
                  onClick={addCustomCrop}
                  className="px-3 py-1.5 rounded-lg bg-slate-900/[0.03] dark:bg-white/[0.04] hover:bg-emerald-500/20 border border-slate-900/[0.08] dark:border-white/[0.08] text-xs font-medium text-white flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t('common_add')}</span>
                </button>
              </div>
              {errors.crops && (
                <p className="text-xs text-rose-700 dark:text-rose-400 flex items-center gap-1" role="alert">
                  <AlertCircle className="w-3 h-3" /> {errors.crops.message}
                </p>
              )}
            </div>

            {/* Farm Size */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-slate-700 dark:text-theme-text-secondary">
                  {t('farmer_register_farm_size') || 'Estimated land holding'}
                </label>
                <div className="flex items-center gap-1.5">
                  {['1.0', '2.5', '5.0', '10.0'].map(sz => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => setValue('farmSize', parseFloat(sz), { shouldValidate: true })}
                      className="px-2 py-0.5 rounded-md text-xxs font-mono tabular-nums bg-slate-900/[0.03] dark:bg-white/[0.04] hover:bg-emerald-500/15 border border-slate-900/[0.08] dark:border-white/[0.08] text-slate-600 dark:text-theme-text-muted hover:text-emerald-300 transition-colors"
                    >
                      {sz} {units.areaUnit === 'ha' ? 'ha' : 'acres'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="relative">
                <Maximize className="w-4 h-4 text-slate-600 dark:text-theme-text-muted absolute start-4 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  step="0.1"
                  {...register('farmSize', { valueAsNumber: true })}
                  placeholder="2.5"
                  className="w-full ps-11 pe-16 py-2.5 rounded-lg border border-slate-900/[0.08] dark:border-white/[0.08] bg-slate-900/[0.03] dark:bg-white/[0.04] text-slate-900 dark:text-theme-text-primary placeholder-white/25 focus:ring-1 focus:ring-emerald-400 focus:border-transparent transition-colors outline-none text-sm font-mono tabular-nums"
                />
                <span className="absolute end-4 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-600 dark:text-theme-text-muted">
                  {units.areaUnit === 'ha' ? t('map_hectares') : t('map_acres', { defaultValue: 'acres' })}
                </span>
              </div>
              {errors.farmSize && (
                <p className="text-xs text-rose-700 dark:text-rose-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {errors.farmSize.message}
                </p>
              )}
            </div>
          </div>

          {/* Card 3: Geolocation Coordinates & NASA POWER Radar */}
          <div className="backdrop-blur-xl bg-slate-50 dark:bg-theme-bg-secondary border border-slate-900/[0.08] dark:border-white/[0.08] rounded-xl p-6 space-y-5 shadow-sm">
            <div className="flex items-center justify-between pb-2 border-b border-slate-900/[0.08] dark:border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <Compass className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                <h2 className="text-sm font-medium text-slate-900 dark:text-theme-text-primary flex items-center gap-1.5">
                  {t('ui_farmer_registration_form_geospatial_telemetry')}
                  <InfoPromptIcon
                    title="GPS & Earth Observation"
                    content="GPS coordinates connect the farm to Sentinel NDVI satellite vegetation monitoring and localized rainfall forecasting."
                    variant="info"
                    ariaLabel="About geospatial telemetry"
                  />
                </h2>
              </div>
              <button
                type="button"
                onClick={handleDetectLocation}
                disabled={isDetectingGps}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-xs font-medium text-emerald-700 dark:text-emerald-400 transition-colors"
              >
                <Compass className={`w-3.5 h-3.5 ${isDetectingGps ? 'animate-spin' : ''}`} />
                <span>{isDetectingGps ? 'Detecting...' : 'Detect GPS'}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-700 dark:text-theme-text-secondary">
                  {t('latitude')}
                </label>
                <input
                  type="number"
                  step="0.000001"
                  {...register('latitude', { setValueAs: optionalNumber })}
                  placeholder="-0.303099"
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-900/[0.08] dark:border-white/[0.08] bg-slate-900/[0.03] dark:bg-white/[0.04] text-slate-900 dark:text-theme-text-primary placeholder-white/25 focus:ring-1 focus:ring-emerald-400 outline-none text-sm font-mono tabular-nums"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-700 dark:text-theme-text-secondary">
                  {t('longitude')}
                </label>
                <input
                  type="number"
                  step="0.000001"
                  {...register('longitude', { setValueAs: optionalNumber })}
                  placeholder="36.080025"
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-900/[0.08] dark:border-white/[0.08] bg-slate-900/[0.03] dark:bg-white/[0.04] text-slate-900 dark:text-theme-text-primary placeholder-white/25 focus:ring-1 focus:ring-emerald-400 outline-none text-sm font-mono tabular-nums"
                />
              </div>
            </div>

            {/* Satellite Telemetry Preview Card */}
            {currentLatitude && currentLongitude ? (
              <div className="p-3.5 rounded-xl bg-slate-900/[0.03] dark:bg-white/[0.04] border border-slate-900/[0.08] dark:border-white/[0.08] space-y-2">
                <div className="flex items-center justify-between text-xxs">
                  <span className="font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                    <Radio className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
                    {t('ui_farmer_registration_form_auto_linked_earth_observation')}
                  </span>
                  <span className="text-slate-600 dark:text-theme-text-muted font-mono">{t('ui_farmer_registration_form_nasa_power_soilgrids')}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 rounded-lg bg-slate-900/[0.03] dark:bg-white/[0.04] border border-slate-900/[0.08] dark:border-white/[0.08]">
                    <div className="text-xxs text-slate-600 dark:text-theme-text-muted">{t('ui_farmer_registration_form_estimated_ph')}</div>
                    <div className="font-medium text-slate-900 dark:text-theme-text-primary mt-0.5 tabular-nums">{t('ui_farmer_registration_form_6_2_optimal')}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900/[0.03] dark:bg-white/[0.04] border border-slate-900/[0.08] dark:border-white/[0.08]">
                    <div className="text-xxs text-slate-600 dark:text-theme-text-muted">{t('ui_farmer_registration_form_rainfall_risk')}</div>
                    <div className="font-medium text-emerald-700 dark:text-emerald-400 mt-0.5 tabular-nums">{t('ui_farmer_registration_form_low_18mm')}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900/[0.03] dark:bg-white/[0.04] border border-slate-900/[0.08] dark:border-white/[0.08]">
                    <div className="text-xxs text-slate-600 dark:text-theme-text-muted">{t('ui_farmer_registration_form_solar_rad')}</div>
                    <div className="font-medium text-amber-800 dark:text-amber-300 mt-0.5 tabular-nums">21.4 MJ/m²</div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xxs text-slate-600 dark:text-theme-text-muted leading-relaxed italic">
                {t('ui_farmer_registration_form_coordinates_are_optional_adding_gps')}
              </p>
            )}
          </div>

          {/* Card 4: Initial Vital Score & Agronomic Health Tier */}
          <div className="backdrop-blur-xl bg-slate-50 dark:bg-theme-bg-secondary border border-slate-900/[0.08] dark:border-white/[0.08] rounded-xl p-6 space-y-5 shadow-sm">
            <div className="flex items-center justify-between pb-2 border-b border-slate-900/[0.08] dark:border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <Activity className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                <h2 className="text-sm font-medium text-slate-900 dark:text-theme-text-primary flex items-center gap-1.5">
                  {t('ui_farmer_registration_form_vital_score_baseline')}
                  <InfoPromptIcon
                    title="Vital Score Health Index"
                    content="Composite score (0–100) reflecting crop vigor, soil moisture level, and pest/disease vulnerability tier."
                    variant="tip"
                    ariaLabel="About vital score baseline"
                  />
                </h2>
              </div>
              {assessedVitalScore === undefined || Number.isNaN(assessedVitalScore) ? (
                <span className="px-2.5 py-0.5 rounded-md text-xs font-medium border border-slate-900/[0.08] dark:border-white/[0.08] text-slate-600 dark:text-theme-text-muted">
                  {t('ui_farmer_registration_form_not_assessed', 'Not assessed yet')}
                </span>
              ) : (
                <span className={`px-2.5 py-0.5 rounded-md text-xs font-medium border tabular-nums ${getVitalScoreColor(currentVitalScore)}`}>
                  {currentVitalScore}/100 · {getVitalScoreLabel(currentVitalScore)}
                </span>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-theme-text-muted font-medium">
                <span>{t('ui_farmer_registration_form_critical_risk_65')}</span>
                <span>{t('ui_farmer_registration_form_moderate_65_79')}</span>
                <span>{t('ui_farmer_registration_form_optimal_80_100')}</span>
              </div>
              <input
                type="range"
                min="30"
                max="100"
                step="1"
                value={currentVitalScore}
                onChange={event => setValue('vitalScore', Number(event.target.value), { shouldValidate: true })}
                aria-label={t('ui_farmer_registration_form_vital_score_label', 'Officer assessment of farm condition, 30 to 100')}
                className="w-full h-2 rounded-lg bg-slate-100 dark:bg-theme-bg-tertiary appearance-none cursor-pointer accent-emerald-400"
              />
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/[0.03] dark:bg-white/[0.04] border border-slate-900/[0.08] dark:border-white/[0.08] text-xs text-slate-700 dark:text-theme-text-secondary space-y-1">
              <div className="font-medium text-slate-900 dark:text-theme-text-primary">{t('ui_farmer_registration_form_dynamic_workflow_dispatch')}</div>
              <p className="text-xxs leading-relaxed text-slate-600 dark:text-theme-text-muted">
                {t('ui_farmer_registration_form_farmers_registered_with_a_vital_scor')} <strong className="text-rose-400 tabular-nums">65</strong> {t('ui_farmer_registration_form_are_instantly_queued_for_priority_on')}
              </p>
            </div>
          </div>
        </div>

        {/* ── Floating Submit Action Bar ── */}
        <div className="backdrop-blur-xl bg-slate-50 dark:bg-theme-bg-secondary border border-slate-900/[0.08] dark:border-white/[0.08] rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-theme-text-muted">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            <span>{t('ui_farmer_registration_form_ready_to_activate_real_time_advisory')}</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => {
                reset();
                setSelectedCrops(['Maize']);
              }}
              className="px-4 py-2.5 rounded-lg bg-slate-900/[0.03] dark:bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-slate-700 dark:text-theme-text-secondary hover:text-slate-900 dark:hover:text-white transition-colors border border-slate-900/[0.08] dark:border-white/[0.08]"
            >
              {t('ui_farmer_registration_form_reset_form')}
            </button>

            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 sm:flex-initial px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
            >
              <UserPlus className="w-4 h-4" />
              <span>{isLoading ? 'Saving…' : 'Save farmer'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default FarmerRegistrationForm;
