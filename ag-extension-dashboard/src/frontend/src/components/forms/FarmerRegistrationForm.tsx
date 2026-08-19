import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { farmerSchema, type FarmerInput } from '@/lib/schemas';
import { useAppStore } from '@/store/useAppStore';
import { useDemoMode } from '@/demo';
import { UserPlus, MapPin, Phone, Maximize, Activity, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '@/lib/LanguageContext';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { createFarmer } from '@/api/farmerService';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';

export const FarmerRegistrationForm: React.FC = () => {
  const { addFarmer, isLoading, setLoading } = useAppStore();
  const { t } = useLanguage();
  const { headingClass } = useThemeClasses();
  const { isDemo } = useDemoMode();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FarmerInput>({
    resolver: zodResolver(farmerSchema),
    defaultValues: {
      crops: [],
      farmSize: 0,
    },
  });

  const onSubmit = async (data: FarmerInput) => {
    setLoading(true);
    try {
      // Call API to create farmer
      const response = await createFarmer({
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        region: data.location,
        village: data.location,
        crops: data.crops || [],
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
        toast.success(t('farmer_register_success'));
        reset();
      }
    } catch (error) {
      toast.error(t('farmer_register_failed'));
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (isDemo) {
    return (
      <div className="max-w-2xl mx-auto p-8 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
          <Lock className="w-8 h-8 text-amber-600 dark:text-amber-400" />
        </div>
        <h2 className={`text-2xl font-bold ${headingClass} mb-2`}>Register Client</h2>
        <p className="text-amber-700 dark:text-amber-300 font-semibold mb-1">
          Not available in demo
        </p>
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          Farmer registration is disabled in demo mode. Sign up for a free account to add and manage
          farmers.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
          <UserPlus className="w-6 h-6 text-primary-600 dark:text-primary-400" />
        </div>
        <div>
          <h2 className={`text-2xl font-bold ${headingClass}`}>Register Client</h2>
          <p className="text-slate-500 dark:text-slate-400">{t('farmer_register_subtitle')}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* First Name */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <UserPlus className="w-4 h-4" />
              {t('farmer_register_first_name') || 'First Name'}
            </label>
            <Input
              {...register('firstName')}
              placeholder={t('farmer_register_first_name_placeholder') || 'Enter first name'}
              error={errors.firstName?.message}
            />
          </div>

          {/* Last Name */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <UserPlus className="w-4 h-4" />
              {t('farmer_register_last_name') || 'Last Name'}
            </label>
            <Input
              {...register('lastName')}
              placeholder={t('farmer_register_last_name_placeholder') || 'Enter last name'}
              error={errors.lastName?.message}
            />
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <Phone className="w-4 h-4" />
              {t('farmer_register_phone')}
            </label>
            <Input
              {...register('phone')}
              placeholder={t('farmer_register_phone_placeholder')}
              error={errors.phone?.message}
            />
          </div>

          {/* Location */}
          <div className="space-y-2 md:col-span-2">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <MapPin className="w-4 h-4" />
              {t('farmer_register_location')}
            </label>
            <Input
              {...register('location')}
              placeholder={t('farmer_register_location_placeholder')}
              error={errors.location?.message}
            />
          </div>

          {/* Farm Size */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <Maximize className="w-4 h-4" />
              {t('farmer_register_farm_size')}
            </label>
            <Input
              type="number"
              step="0.1"
              {...register('farmSize', { valueAsNumber: true })}
              error={errors.farmSize?.message}
            />
          </div>

          {/* Language Preference */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {t('farmers_language')}
            </label>
            <Select
              {...register('languagePreference')}
              options={[
                { value: 'en', label: 'English (en)' },
                { value: 'sw', label: 'Swahili (sw)' },
                { value: 'lug', label: 'Luganda (lug)' },
                { value: 'ny', label: 'Chichewa (ny)' },
                { value: 'am', label: 'Amharic (am)' },
                { value: 'oro', label: 'Afaan Oromoo (oro)' },
                { value: 'fr', label: 'French (fr)' },
              ]}
            />
          </div>

          {/* Performance & Health */}
          <div className="space-y-4 md:col-span-2 p-4 bg-primary-50 dark:bg-primary-900/10 rounded-xl border border-primary-100 dark:border-primary-800/50">
            <h3 className="text-sm font-bold text-primary-700 dark:text-primary-300 uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Performance & Health
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Initial Vital Score (0-100)
                </label>
                <Input
                  type="number"
                  {...register('vitalScore', { valueAsNumber: true })}
                  placeholder="e.g. 85"
                />
              </div>
            </div>
          </div>

          {/* Geolocation */}
          <div className="space-y-4 md:col-span-2 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                <MapPin className="w-4 h-4 text-primary-500" />
                {t('gps_coordinates')}
              </label>
              <button
                type="button"
                onClick={() => {
                  if (!navigator.geolocation) {
                    toast.error('Geolocation is not supported by your browser');
                    return;
                  }
                  navigator.geolocation.getCurrentPosition(
                    position => {
                      const { latitude, longitude } = position.coords;
                      setValue('latitude', latitude);
                      setValue('longitude', longitude);
                      toast.success('Location detected!');
                    },
                    error => {
                      toast.error('Failed to get location: ' + error.message);
                    }
                  );
                }}
                className="text-xs font-bold text-primary-600 dark:text-primary-400 hover:underline"
              >
                {t('detect_location')}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Input
                  type="number"
                  step="0.000001"
                  {...register('latitude', { valueAsNumber: true })}
                  placeholder={t('latitude')}
                />
              </div>
              <div className="space-y-1">
                <Input
                  type="number"
                  step="0.000001"
                  {...register('longitude', { valueAsNumber: true })}
                  placeholder={t('longitude')}
                />
              </div>
            </div>
          </div>
        </div>

        <Button type="submit" loading={isLoading} className="w-full py-3">
          <UserPlus className="w-5 h-5" />
          {t('farmer_register_button')}
        </Button>
      </form>
    </div>
  );
};
