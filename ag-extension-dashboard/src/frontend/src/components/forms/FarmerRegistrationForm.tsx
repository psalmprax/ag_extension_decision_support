import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { farmerSchema, type FarmerInput } from '@/lib/schemas';
import { useAppStore } from '@/store/useAppStore';
import { Loader2, UserPlus, MapPin, Phone, Maximize } from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '@/lib/LanguageContext';
import { createFarmer } from '@/api/farmerService';

export const FarmerRegistrationForm: React.FC = () => {
  const { addFarmer, isLoading, setLoading } = useAppStore();
  const { t } = useLanguage();

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
        firstName: data.name.split(' ')[0],
        lastName: data.name.split(' ').slice(1).join(' ') || '',
        phone: data.phone,
        region: data.location,
        village: data.location,
        crops: data.crops || [],
        farmSize: data.farmSize || 0,
      });

      if (response.success) {
        addFarmer({
          id: response.data.id,
          name: `${response.data.firstName} ${response.data.lastName}`,
          phone: response.data.phone,
          location: response.data.region || response.data.village,
          crops: response.data.crops,
          farmSize: response.data.farmSize,
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

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
          <UserPlus className="w-6 h-6 text-primary-600 dark:text-primary-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{t('farmer_register_title')}</h2>
          <p className="text-slate-500 dark:text-slate-400">{t('farmer_register_subtitle')}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Name */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <UserPlus className="w-4 h-4" />
              {t('farmer_register_name')}
            </label>
            <input
              {...register('name')}
              className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none transition-all"
              placeholder={t('farmer_register_name_placeholder')}
            />
            {errors.name && (
              <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>
            )}
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <Phone className="w-4 h-4" />
              {t('farmer_register_phone')}
            </label>
            <input
              {...register('phone')}
              className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none transition-all"
              placeholder={t('farmer_register_phone_placeholder')}
            />
            {errors.phone && (
              <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>
            )}
          </div>

          {/* Location */}
          <div className="space-y-2 md:col-span-2">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <MapPin className="w-4 h-4" />
              {t('farmer_register_location')}
            </label>
            <input
              {...register('location')}
              className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none transition-all"
              placeholder={t('farmer_register_location_placeholder')}
            />
            {errors.location && (
              <p className="text-red-500 text-xs mt-1">{errors.location.message}</p>
            )}
          </div>

          {/* Farm Size */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <Maximize className="w-4 h-4" />
              {t('farmer_register_farm_size')}
            </label>
            <input
              type="number"
              step="0.1"
              {...register('farmSize', { valueAsNumber: true })}
              className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none transition-all"
            />
            {errors.farmSize && (
              <p className="text-red-500 text-xs mt-1">{errors.farmSize.message}</p>
            )}
          </div>

          {/* Language Preference */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {t('farmers_language')}
            </label>
            <select
              {...register('languagePreference')}
              className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none transition-all"
            >
              <option value="en">English (en)</option>
              <option value="sw">Swahili (sw)</option>
              <option value="lug">Luganda (lug)</option>
              <option value="ny">Chichewa (ny)</option>
              <option value="am">Amharic (am)</option>
              <option value="oro">Afaan Oromoo (oro)</option>
              <option value="fr">French (fr)</option>
            </select>
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
                    (position) => {
                      const { latitude, longitude } = position.coords;
                      setValue('latitude', latitude);
                      setValue('longitude', longitude);
                      toast.success('Location detected!');
                    },
                    (error) => {
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
                <input
                  type="number"
                  step="0.000001"
                  {...register('latitude', { valueAsNumber: true })}
                  placeholder={t('latitude')}
                  className="w-full px-4 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
                />
              </div>
              <div className="space-y-1">
                <input
                  type="number"
                  step="0.000001"
                  {...register('longitude', { valueAsNumber: true })}
                  placeholder={t('longitude')}
                  className="w-full px-4 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-400 text-white font-semibold rounded-lg shadow-md transition-all active:scale-95"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <UserPlus className="w-5 h-5" />
              {t('farmer_register_button')}
            </>
          )}
        </button>
      </form>
    </div>
  );
};
