import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { fetchFarmers } from '@/api/farmerService';
import { createVisit } from '@/api/visitService';
import { useLanguage } from '@/lib/LanguageContext';
import { useSavedNotice } from '@/components/crops/useCropCycleActions';

export interface SchedulableFarmer {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string;
  region?: string;
  village?: string;
}

const EMPTY_FORM = { farmerId: '', type: 'routine', scheduledAt: '', notes: '', farmerSearch: '' };
const DEMO_FARMER: SchedulableFarmer = { id: 'demo-farmer', firstName: 'Demo', lastName: 'Farmer', phone: '+0000000000', region: 'Demo Region', village: 'Demo Village' };

/** The schedule-a-visit form: the farmers to choose from, the search, and saving the visit. */
export function useVisitScheduler({ isOpen, isDemo, onSuccess, onClose }: { isOpen: boolean; isDemo: boolean; onSuccess: () => void; onClose: () => void }) {
  const { t } = useLanguage();
  const savedNotice = useSavedNotice();
  const [loading, setLoading] = useState(false);
  const [farmers, setFarmers] = useState<SchedulableFarmer[]>([]);
  const [loadingFarmers, setLoadingFarmers] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);

  useEffect(() => {
    if (!isOpen) return;
    if (isDemo) {
      // Demo: only the canonical "Demo Farmer" is available
      setFarmers([DEMO_FARMER]);
      return;
    }
    setLoadingFarmers(true);
    fetchFarmers()
      .then(data => {
        if (data.success && data.data?.farmers) setFarmers(data.data.farmers);
      })
      .catch(error => {
        console.error('Failed to fetch farmers:', error);
        toast.error(t('visit_farmers_unavailable', { defaultValue: 'Farmers could not be loaded. Close this and try again.' }));
      })
      .finally(() => setLoadingFarmers(false));
  }, [isOpen, isDemo, t]);

  // One rule for the list and for "no farmers": name, region or phone.
  const matches = useMemo(() => {
    const search = formData.farmerSearch.trim().toLowerCase();
    if (!search) return [];
    return farmers.filter(f => `${f.firstName} ${f.lastName}`.toLowerCase().includes(search) || (f.region || '').toLowerCase().includes(search) || (f.phone || '').includes(search));
  }, [farmers, formData.farmerSearch]);

  const finish = () => {
    onSuccess();
    onClose();
    setFormData(EMPTY_FORM);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.farmerId || !formData.scheduledAt) return;

    // Demo mode: skip the network call entirely; just simulate success so the
    // user sees the expected UX without hitting the backend with a fake farmer id.
    if (isDemo) {
      toast.success(t('visit_create_success') || 'Visit scheduled (demo)');
      finish();
      return;
    }

    setLoading(true);
    try {
      const data = await createVisit({
        farmer_id: formData.farmerId,
        visit_type: formData.type,
        scheduled_at: new Date(formData.scheduledAt).toISOString(),
        notes: formData.notes,
      });
      if (!data.success) {
        toast.error(t('visit_create_failed'));
        return;
      }
      if (data.queued) toast.success(savedNotice(true, ''));
      finish();
    } catch (error) {
      console.error('Failed to create visit:', error);
      toast.error(t('visit_create_failed'));
    } finally {
      setLoading(false);
    }
  };

  const selectFarmer = (farmer: SchedulableFarmer) => setFormData({ ...formData, farmerId: farmer.id, farmerSearch: `${farmer.firstName} ${farmer.lastName}` });
  const clearFarmer = () => setFormData({ ...formData, farmerId: '', farmerSearch: '' });

  return { loading, loadingFarmers, formData, setFormData, matches, selectFarmer, clearFarmer, handleSubmit };
}
