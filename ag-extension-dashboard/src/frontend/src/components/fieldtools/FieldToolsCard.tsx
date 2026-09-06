import { useMemo, useState } from 'react';
import { Calculator, FlaskConical, Sprout, Droplets } from 'lucide-react';
import { tankMix, fertilizerBlend, plantingDensity, herbicideTankDose } from '@/lib/agCalculators';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { useLanguage } from '@/lib/LanguageContext';

type Tab = 'tank' | 'blend' | 'density';

const inputCls =
    'w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent';

function NumField({ label, value, onChange, step = 'any', suffix }: { label: string; value: number | ''; onChange: (v: number | '') => void; step?: string; suffix?: string }) {
    return (
        <label className="block">
            <span className="text-xxs font-bold uppercase tracking-widest text-gray-400">{label}</span>
            <span className="flex items-center gap-1">
                <input
                    type="number"
                    step={step}
                    min="0"
                    value={value}
                    onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))}
                    className={inputCls}
                />
                {suffix && <span className="text-xs text-gray-400 shrink-0">{suffix}</span>}
            </span>
        </label>
    );
}

export function FieldToolsCard() {
    const { cardClass } = useThemeClasses();
    const { t } = useLanguage();
    const [tab, setTab] = useState<Tab>('tank');

    // tank mix state
    const [rate, setRate] = useState<number | ''>(1.5);
    const [area, setArea] = useState<number | ''>(1);
    const [tank, setTank] = useState<number | ''>(16);
    const [water, setWater] = useState<number | ''>(200);

    // blend state
    const [n, setN] = useState<number | ''>(92);
    const [p, setP] = useState<number | ''>(46);
    const [k, setK] = useState<number | ''>(0);
    const [blendArea, setBlendArea] = useState<number | ''>(1);

    // density state
    const [row, setRow] = useState<number | ''>(0.9);
    const [inRow, setInRow] = useState<number | ''>(0.25);
    const [densArea, setDensArea] = useState<number | ''>(1);

    const tankResult = useMemo(() => {
        try {
            return { ok: true as const, ...tankMix({ productRatePerHa: Number(rate), areaHa: Number(area), tankVolumeL: Number(tank), waterRateLPerHa: Number(water) }), herbicide: herbicideTankDose({ productRateLPerHa: Number(rate), tankVolumeL: Number(tank), waterRateLPerHa: Number(water) }) };
        } catch {
            return { ok: false as const };
        }
    }, [rate, area, tank, water]);

    const blendResult = useMemo(() => {
        try {
            return { ok: true as const, ...fertilizerBlend({ targetN: Number(n), targetP: Number(p), targetK: Number(k), areaHa: Number(blendArea) }) };
        } catch {
            return { ok: false as const };
        }
    }, [n, p, k, blendArea]);

    const densityResult = useMemo(() => {
        try {
            return { ok: true as const, ...plantingDensity(Number(row), Number(inRow), Number(densArea)) };
        } catch {
            return { ok: false as const };
        }
    }, [row, inRow, densArea]);

    const tabs: { key: Tab; label: string; Icon: typeof Calculator }[] = [
        { key: 'tank', label: t('fieldtools_tab_tank', { defaultValue: 'Tank mix' }), Icon: Droplets },
        { key: 'blend', label: t('fieldtools_tab_blend', { defaultValue: 'Fertilizer' }), Icon: FlaskConical },
        { key: 'density', label: t('fieldtools_tab_density', { defaultValue: 'Plant density' }), Icon: Sprout },
    ];

    return (
        <div className={`${cardClass} p-4 sm:p-5`}>
            <div className="flex items-center gap-2 mb-3">
                <Calculator className="w-4 h-4 text-primary-500" />
                <h3 className="text-sm font-black uppercase tracking-widest">
                    {t('fieldtools_title', { defaultValue: 'Field Calculators' })}
                </h3>
                <span className="text-xxs text-gray-400 ml-auto">
                    {t('fieldtools_works_offline', { defaultValue: 'works offline' })}
                </span>
            </div>

            <div className="flex gap-1.5 mb-3">
                {tabs.map(({ key, label, Icon }) => (
                    <button
                        key={key}
                        onClick={() => setTab(key)}
                        aria-pressed={tab === key}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold ${tab === key ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}
                    >
                        <Icon className="w-3.5 h-3.5" />
                        {label}
                    </button>
                ))}
            </div>

            {tab === 'tank' && (
                <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                        <NumField label="Product rate" value={rate} onChange={setRate} suffix="L/ha" />
                        <NumField label="Area" value={area} onChange={setArea} suffix="ha" />
                        <NumField label="Tank size" value={tank} onChange={setTank} suffix="L" />
                        <NumField label="Water rate" value={water} onChange={setWater} suffix="L/ha" />
                    </div>
                    {tankResult.ok && (
                        <div className="p-3 bg-primary-500/5 rounded-xl text-xs space-y-1">
                            <p><span className="font-bold">{tankResult.productPerTank}</span> product per {tank}L tank · <span className="font-bold">{tankResult.herbicide.mlPerTank}ml</span>/tank</p>
                            <p className="text-gray-500 dark:text-gray-400">{tankResult.tanksNeeded} tanks · {tankResult.waterTotalL}L water total · {tankResult.productTotal} product total</p>
                        </div>
                    )}
                </div>
            )}

            {tab === 'blend' && (
                <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                        <NumField label="Target N" value={n} onChange={setN} suffix="kg/ha" />
                        <NumField label="Target P₂O₅" value={p} onChange={setP} suffix="kg/ha" />
                        <NumField label="Target K₂O" value={k} onChange={setK} suffix="kg/ha" />
                        <NumField label="Area" value={blendArea} onChange={setBlendArea} suffix="ha" />
                    </div>
                    {blendResult.ok && (
                        <div className="p-3 bg-primary-500/5 rounded-xl text-xs space-y-1">
                            <p>Urea 46-0-0: <span className="font-bold">{blendResult.ureaKg} kg</span></p>
                            <p>TSP 0-46-0: <span className="font-bold">{blendResult.tspKg} kg</span></p>
                            <p>MOP 0-0-60: <span className="font-bold">{blendResult.mopKg} kg</span></p>
                        </div>
                    )}
                </div>
            )}

            {tab === 'density' && (
                <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                        <NumField label="Row spacing" value={row} onChange={setRow} step="0.05" suffix="m" />
                        <NumField label="In-row spacing" value={inRow} onChange={setInRow} step="0.05" suffix="m" />
                        <NumField label="Area" value={densArea} onChange={setDensArea} suffix="ha" />
                    </div>
                    {densityResult.ok && (
                        <div className="p-3 bg-primary-500/5 rounded-xl text-xs space-y-1">
                            <p><span className="font-bold">{densityResult.plantsPerHa.toLocaleString()}</span> plants/ha</p>
                            <p className="text-gray-500 dark:text-gray-400">{densityResult.plantsTotal.toLocaleString()} plants · ~{densityResult.seedKgApprox} kg seed (15% oversow)</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
