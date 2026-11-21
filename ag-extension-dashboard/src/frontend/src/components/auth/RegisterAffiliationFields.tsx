import React from 'react';
import { useLanguage } from '@/lib/LanguageContext';
import { SUPPORTED_COUNTRIES } from '@/lib/countries';
import { CountryCoverageNote } from './CountryCoverageNote';
import {
  FIELD_INPUT_CLASS,
  FIELD_LABEL_CLASS,
  FIELD_SELECT_CLASS,
  type RegisterFormState,
} from './registerForm';

interface RegisterAffiliationFieldsProps {
  formData: RegisterFormState;
  onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  regionOptions: string[];
}

export function RegisterAffiliationFields({
  formData,
  onChange,
  regionOptions,
}: RegisterAffiliationFieldsProps) {
  const { t } = useLanguage();
  const regionRequired = formData.role === 'extension_officer';

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="reg-phone" className={FIELD_LABEL_CLASS}>
            {t('register_phone_label')}
          </label>
          <input
            id="reg-phone"
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={onChange}
            className={FIELD_INPUT_CLASS}
            placeholder={t('register_phone_placeholder')}
            autoComplete="tel"
          />
        </div>
        <div>
          <label htmlFor="reg-organization" className={FIELD_LABEL_CLASS}>
            {t('register_organization_label')}
          </label>
          <input
            id="reg-organization"
            type="text"
            name="organization"
            value={formData.organization}
            onChange={onChange}
            className={FIELD_INPUT_CLASS}
            placeholder={t('register_organization_placeholder')}
            autoComplete="organization"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="reg-country" className={FIELD_LABEL_CLASS}>
            {t('register_country_label', { defaultValue: 'Country' })}
          </label>
          <select
            id="reg-country"
            name="country"
            value={formData.country}
            onChange={onChange}
            required
            className={FIELD_SELECT_CLASS}
          >
            {SUPPORTED_COUNTRIES.map((country) => (
              <option key={country.name} value={country.name}>
                {country.name}
              </option>
            ))}
          </select>
          <CountryCoverageNote country={formData.country} />
        </div>
        <div>
          <label htmlFor="reg-region" className={FIELD_LABEL_CLASS}>
            {t('register_region_label', { defaultValue: 'Region' })}
          </label>
          {regionOptions.length > 0 ? (
            <select
              id="reg-region"
              name="region"
              value={formData.region}
              onChange={onChange}
              required={regionRequired}
              className={FIELD_SELECT_CLASS}
            >
              <option value="">
                {t('register_region_placeholder', { defaultValue: 'Select your region' })}
              </option>
              {regionOptions.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </select>
          ) : (
            <input
              id="reg-region"
              name="region"
              value={formData.region}
              onChange={onChange}
              required={regionRequired}
              placeholder={t('register_region_placeholder', { defaultValue: 'Select your region' })}
              className={FIELD_INPUT_CLASS}
              autoComplete="address-level1"
            />
          )}
          {regionRequired && (
            <p className="mt-1 text-[11px] text-white/50">
              {t('ui_register_affiliation_fields_your_regional_manager_is_assigned_fr')}
            </p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="reg-role" className={FIELD_LABEL_CLASS}>
          {t('register_role_label')}
        </label>
        <select
          id="reg-role"
          name="role"
          value={formData.role}
          onChange={onChange}
          className={FIELD_SELECT_CLASS}
        >
          <option value="extension_officer">{t('register_role_extension_officer')}</option>
          <option value="farmer">{t('register_role_farmer')}</option>
        </select>
      </div>
    </>
  );
}
