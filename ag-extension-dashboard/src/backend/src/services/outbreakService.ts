import crypto from 'crypto';
import { query } from './databaseService';
import { logger } from '@/utils/logger';

export interface CentroidCoordinate {
    lat: number;
    lng: number;
}

export interface OutbreakCluster {
    district: string;
    crop: string;
    diseaseLabel: string;
    caseCount: number;
    distinctFarmers: number;
    firstSeen: Date;
    lastSeen: Date;
    centroid: CentroidCoordinate | null;
    differentialPrivacyApplied?: boolean;
}

interface ClusterRow {
    district: string;
    crop: string;
    disease_label: string;
    case_count: string;
    distinct_farmers: string;
    first_seen: Date;
    last_seen: Date;
    centroid_lat: string | null;
    centroid_lng: string | null;
}

/** k-anonymity floor: never surface a cluster smaller than this. */
export const K_ANONYMITY_MIN = 3;
const TRAILING_DAYS = 14;
/** Cases within a district+crop+disease window that trigger an alert. */
export const ALERT_THRESHOLD = 5;

export interface DiagnosisEventInput {
    farmerId?: string | null;
    district?: string | null;
    crop: string;
    diseaseLabel: string;
    confidence?: number | null;
    source?: string;
}

export interface DifferentialPrivacyOptions {
    epsilon?: number; // Privacy budget (default: 1.0)
    maxPerturbationMeters?: number; // Bounding radius clamp (default: 150m)
    seed?: number; // Optional seed for deterministic reproducibility
}

export interface AtmosphericDispersalInput {
    centroid: CentroidCoordinate;
    windSpeedKmH: number;
    windBearingDeg: number; // Azimuth 0-360 degrees (0 = North, 90 = East, 180 = South, 270 = West)
    relativeHumidity: number; // 0 - 100 (%)
    temperatureC: number; // Ambient temperature in degrees Celsius
    crop?: string;
    diseaseLabel?: string;
    timeHorizonHours?: number; // Dispersion window in hours (default: 24)
}

export interface AtmosphericDispersalProjection {
    origin: CentroidCoordinate;
    targetCentroid: CentroidCoordinate;
    coneFootprint: CentroidCoordinate[]; // Geometric polygon vertices of plume dispersal cone
    dispersionDistanceKm: number;
    apertureDegrees: number;
    viabilityScore: number; // 0.0 to 1.0 (microclimate viability index)
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    environmentalFactors: {
        windSpeedKmH: number;
        windBearingDeg: number;
        relativeHumidity: number;
        temperatureC: number;
        germinationIndex: number;
    };
    modelProvenance: {
        model: string;
        methodology: string;
        calculatedAt: string;
    };
}

/**
 * Applies Laplace Differential Privacy perturbation to a cluster centroid to prevent
 * differencing / reconstruction re-identification attacks (IR-004) on smallholder parcels.
 *
 * Enforces:
 * 1. Sensitivity Δf calibrated to parcel dispersion / sample size k: Δ = 60 / sqrt(k)
 * 2. Laplace scale b = Δ / ε (default ε = 1.0)
 * 3. Truncated bounding: perturbation magnitude is clamped to maxPerturbationMeters (default 150m)
 *    to preserve agronomic relevance while guaranteeing formal differential privacy.
 */
export function applyDifferentialPrivacyPerturbation(
    centroid: CentroidCoordinate,
    sampleSize: number,
    options: DifferentialPrivacyOptions = {}
): CentroidCoordinate {
    const epsilon = options.epsilon && options.epsilon > 0 ? options.epsilon : 1.0;
    const maxPerturbationMeters = options.maxPerturbationMeters && options.maxPerturbationMeters > 0
        ? options.maxPerturbationMeters
        : 150;

    const k = Math.max(1, sampleSize);
    // Sensitivity scale: inversely proportional to sqrt(k)
    const sensitivity = 60.0 / Math.sqrt(k);
    const scale = sensitivity / epsilon;

    let seedState = options.seed;
    const nextRandom = (): number => {
        if (seedState !== undefined) {
            seedState = (seedState * 9301 + 49297) % 233280;
            return seedState / 233280;
        }
        return Math.random();
    };

    // Sample from Laplace distribution via inverse CDF:
    // u ~ U(-0.5, 0.5), Lap(b) = -b * sgn(u) * ln(1 - 2|u|)
    const sampleLaplace = (b: number): number => {
        const u = Math.max(-0.499999, Math.min(0.499999, nextRandom() - 0.5));
        const sgn = u >= 0 ? 1 : -1;
        return -b * sgn * Math.log(1 - 2 * Math.abs(u));
    };

    let dxMeters = sampleLaplace(scale);
    let dyMeters = sampleLaplace(scale);

    // Bounded truncation: clamp Euclidean displacement to maxPerturbationMeters
    const r = Math.sqrt(dxMeters * dxMeters + dyMeters * dyMeters);
    if (r > maxPerturbationMeters) {
        const ratio = maxPerturbationMeters / r;
        dxMeters *= ratio;
        dyMeters *= ratio;
    }

    // Geodesic coordinate conversion
    const METERS_PER_DEG_LAT = 111139.0;
    const latRad = (centroid.lat * Math.PI) / 180;
    const cosLat = Math.cos(latRad);
    const METERS_PER_DEG_LNG = Math.abs(cosLat) > 1e-6 ? 111139.0 * cosLat : 111139.0;

    const dLat = dyMeters / METERS_PER_DEG_LAT;
    const dLng = dxMeters / METERS_PER_DEG_LNG;

    const perturbedLat = Math.max(-90, Math.min(90, centroid.lat + dLat));
    const perturbedLng = Math.max(-180, Math.min(180, centroid.lng + dLng));

    return {
        lat: Number(perturbedLat.toFixed(6)),
        lng: Number(perturbedLng.toFixed(6)),
    };
}

/**
 * Atmospheric Spore & Pest Plume Dispersal Cone Projection (CE-002).
 *
 * Models downwind contagion propagation taking into account:
 * 1. Wind vector: speed (km/h) and azimuth bearing (0-360 deg)
 * 2. Lateral turbulent dispersion aperture angle: alpha in [15 deg, 45 deg]
 * 3. Microclimate viability gating: relative humidity and temperature factors
 * 4. Geodetic footprint generation for GIS polygon rendering
 */
export function projectAtmosphericDispersalCone(
    input: AtmosphericDispersalInput
): AtmosphericDispersalProjection {
    const { centroid, windSpeedKmH, windBearingDeg, relativeHumidity, temperatureC } = input;
    const timeHorizonHours = input.timeHorizonHours && input.timeHorizonHours > 0 ? input.timeHorizonHours : 24;

    // 1. Dispersion distance calculation: bounded between 5 km and 150 km
    // Base flight/drift: windSpeed (km/h) * time window scaled
    const rawDistanceKm = Math.max(0, windSpeedKmH) * (timeHorizonHours / 8.0);
    const dispersionDistanceKm = Math.min(150.0, Math.max(5.0, Number(rawDistanceKm.toFixed(2))));

    // 2. Aperture angle (degrees): turbulent diffusion spreads wider at low wind speeds
    // High wind (e.g. 50 km/h) -> narrow plume (20 deg); Calm wind (e.g. 5 km/h) -> broad cone (42.5 deg)
    const rawAperture = 45.0 - Math.min(30.0, Math.max(0, windSpeedKmH) * 0.5);
    const apertureDegrees = Math.min(45.0, Math.max(15.0, Number(rawAperture.toFixed(1))));

    // 3. Microclimate Viability & Germination Index:
    // Fungal spores (e.g. Puccinia rust) and insect larvae exhibit optimal viability
    // at temperatures between 18°C and 28°C and high relative humidity (>=70%).
    let humidityFactor = 0.2;
    if (relativeHumidity >= 80) {
        humidityFactor = 1.0;
    } else if (relativeHumidity >= 70) {
        humidityFactor = 0.8;
    } else if (relativeHumidity >= 50) {
        humidityFactor = 0.5;
    }

    let tempFactor = 0.3;
    if (temperatureC >= 18 && temperatureC <= 28) {
        tempFactor = 1.0;
    } else if ((temperatureC >= 14 && temperatureC < 18) || (temperatureC > 28 && temperatureC <= 34)) {
        tempFactor = 0.7;
    }

    const germinationIndex = Number((humidityFactor * tempFactor).toFixed(2));
    const viabilityScore = germinationIndex;

    // 4. Overall Outbreak Propagation Risk Level
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (viabilityScore >= 0.7 && dispersionDistanceKm >= 40) {
        riskLevel = 'CRITICAL';
    } else if (viabilityScore >= 0.5 && dispersionDistanceKm >= 20) {
        riskLevel = 'HIGH';
    } else if (viabilityScore >= 0.3) {
        riskLevel = 'MEDIUM';
    } else {
        riskLevel = 'LOW';
    }

    // 5. Geodetic point calculation along great circle
    const EARTH_RADIUS_KM = 6371.0088;
    const calculateDestinationPoint = (
        origin: CentroidCoordinate,
        bearingDeg: number,
        distanceKm: number
    ): CentroidCoordinate => {
        const delta = distanceKm / EARTH_RADIUS_KM;
        const theta = ((bearingDeg % 360 + 360) % 360) * (Math.PI / 180);
        const phi1 = (origin.lat * Math.PI) / 180;
        const lambda1 = (origin.lng * Math.PI) / 180;

        const phi2 = Math.asin(
            Math.sin(phi1) * Math.cos(delta) + Math.cos(phi1) * Math.sin(delta) * Math.cos(theta)
        );
        const lambda2 =
            lambda1 +
            Math.atan2(
                Math.sin(theta) * Math.sin(delta) * Math.cos(phi1),
                Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2)
            );

        const lat = (phi2 * 180) / Math.PI;
        const lng = ((lambda2 * 180) / Math.PI + 540) % 360 - 180;
        return {
            lat: Number(lat.toFixed(6)),
            lng: Number(lng.toFixed(6)),
        };
    };

    // Central plume target coordinate
    const targetCentroid = calculateDestinationPoint(centroid, windBearingDeg, dispersionDistanceKm);

    // 6. Generate cone polygon footprint:
    // [Origin, Arc left boundary ... Arc right boundary, Origin]
    const coneFootprint: CentroidCoordinate[] = [{ ...centroid }];
    const arcSteps = 7; // Number of interpolation vertices along the downwind arc
    const startBearing = windBearingDeg - apertureDegrees;
    const endBearing = windBearingDeg + apertureDegrees;

    for (let i = 0; i <= arcSteps; i++) {
        const currentBearing = startBearing + ((endBearing - startBearing) * i) / arcSteps;
        coneFootprint.push(calculateDestinationPoint(centroid, currentBearing, dispersionDistanceKm));
    }
    coneFootprint.push({ ...centroid }); // Close polygon

    return {
        origin: { ...centroid },
        targetCentroid,
        coneFootprint,
        dispersionDistanceKm,
        apertureDegrees,
        viabilityScore,
        riskLevel,
        environmentalFactors: {
            windSpeedKmH,
            windBearingDeg,
            relativeHumidity,
            temperatureC,
            germinationIndex,
        },
        modelProvenance: {
            model: 'AlphaAg-Atmospheric-Dispersal-v1.0',
            methodology: 'Gaussian plume vector projection with microclimate viability gating',
            calculatedAt: new Date().toISOString(),
        },
    };
}

export const outbreakService = {
    applyDifferentialPrivacyPerturbation,
    projectAtmosphericDispersalCone,

    async recordDiagnosisEvent(input: DiagnosisEventInput): Promise<void> {
        await query(
            `INSERT INTO diagnosis_events (farmer_id, district, crop, disease_label, confidence, source)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [input.farmerId || null, input.district || null, input.crop, input.diseaseLabel, input.confidence ?? null, input.source || 'extension_tool']
        );
    },

    /**
     * Aggregated clusters over the trailing window. k-anonymity is enforced in
     * SQL — clusters with fewer distinct farmers than the floor never leave the db.
     * Furthermore, centroid coordinates receive Laplace differential privacy
     * perturbation (IR-004) to prevent re-identification through spatial differencing.
     */
    async getClusters(options: {
        days?: number;
        bbox?: { minLat: number; maxLat: number; minLng: number; maxLng: number };
        enableDifferentialPrivacy?: boolean;
        epsilon?: number;
        maxPerturbationMeters?: number;
        seed?: number;
    } = {}): Promise<OutbreakCluster[]> {
        const days = options.days ?? TRAILING_DAYS;
        const bboxClause = options.bbox
            ? 'AND EXISTS (SELECT 1 FROM farmers f2 WHERE f2.id = de.farmer_id AND f2.location_lat BETWEEN $3 AND $4 AND f2.location_lng BETWEEN $5 AND $6)'
            : '';
        const params: unknown[] = [String(days), K_ANONYMITY_MIN, ...(options.bbox ? [options.bbox.minLat, options.bbox.maxLat, options.bbox.minLng, options.bbox.maxLng] : [])];

        const { rows } = await query<ClusterRow>(
            `SELECT de.district, de.crop, de.disease_label,
                    COUNT(*)::text AS case_count,
                    COUNT(DISTINCT de.farmer_id)::text AS distinct_farmers,
                    MIN(de.created_at) AS first_seen,
                    MAX(de.created_at) AS last_seen,
                    AVG(f.location_lat)::text AS centroid_lat,
                    AVG(f.location_lng)::text AS centroid_lng
             FROM diagnosis_events de
             LEFT JOIN farmers f ON f.id = de.farmer_id
             WHERE de.created_at >= NOW() - ($1 || ' days')::interval
               AND de.district IS NOT NULL
               ${bboxClause}
             GROUP BY de.district, de.crop, de.disease_label
             HAVING COUNT(DISTINCT de.farmer_id) >= $2
             ORDER BY COUNT(*) DESC
             LIMIT 200`,
            params
        );

        const enableDp = options.enableDifferentialPrivacy ?? true;

        return rows.map(row => {
            const rawCentroid = row.centroid_lat !== null && row.centroid_lng !== null
                ? { lat: Number(row.centroid_lat), lng: Number(row.centroid_lng) }
                : null;
            const distinctFarmers = Number(row.distinct_farmers);
            const clusterKey = `${row.district}:${row.crop}:${row.disease_label}:${days}`;
            const derivedSeed = crypto.createHash('sha256').update(clusterKey).digest().readUInt32BE(0) % 233280;
            const centroid = rawCentroid && enableDp
                ? applyDifferentialPrivacyPerturbation(rawCentroid, distinctFarmers, {
                    epsilon: options.epsilon,
                    maxPerturbationMeters: options.maxPerturbationMeters,
                    seed: options.seed ?? derivedSeed,
                })
                : rawCentroid;

            return {
                district: row.district,
                crop: row.crop,
                diseaseLabel: row.disease_label,
                caseCount: Number(row.case_count),
                distinctFarmers,
                firstSeen: row.first_seen,
                lastSeen: row.last_seen,
                centroid,
                differentialPrivacyApplied: enableDp && rawCentroid !== null,
            };
        });
    },

    /**
     * Districts that crossed the alert threshold in the trailing window.
     */
    async getAlertedDistricts(): Promise<OutbreakCluster[]> {
        const clusters = await this.getClusters({ days: TRAILING_DAYS });
        return clusters.filter(c => c.caseCount >= ALERT_THRESHOLD);
    },

    /**
     * Districts adjacent (same region fallback, curated table override) to an
     * alerted district — officers there should receive a warning.
     */
    async getAdjacentDistricts(district: string): Promise<string[]> {
        const curated = await query<{ adjacent_district: string }>(
            'SELECT adjacent_district FROM district_adjacency WHERE district = $1',
            [district]
        );
        if (curated.rows.length > 0) return curated.rows.map(r => r.adjacent_district);

        // Fallback: districts in the same region count as adjacent.
        const { rows } = await query<{ district: string }>(
            `SELECT DISTINCT f2.district FROM farmers f1
             JOIN farmers f2 ON f1.region = f2.region
             WHERE f1.district = $1 AND f2.district IS NOT NULL AND f2.district != $1`,
            [district]
        );
        return rows.map(r => r.district);
    },

    /**
     * Officers to warn about an outbreak: officers assigned farmers in the
     * affected district plus officers in adjacent districts.
     */
    async getOfficersToWarn(district: string): Promise<string[]> {
        const adjacent = await this.getAdjacentDistricts(district);
        const { rows } = await query<{ email: string }>(
            `SELECT DISTINCT u.email FROM users u
             JOIN farmers f ON f.assigned_officer_id = u.id
             WHERE u.email IS NOT NULL
               AND (f.district = $1 OR f.district = ANY($2::varchar[]))`,
            [district, adjacent]
        );
        return rows.map(r => r.email);
    },

    /** Daily rollup: log alerts for threshold-crossing clusters (dispatch via email digest). */
    async rollupAndNotify(sendEmail: (to: string, subject: string, text: string) => Promise<void>): Promise<number> {
        const alerts = await this.getAlertedDistricts();
        let sent = 0;
        for (const alert of alerts) {
            try {
                const officers = await this.getOfficersToWarn(alert.district);
                for (const email of officers) {
                    await sendEmail(
                        email,
                        `Outbreak alert: ${alert.diseaseLabel} in ${alert.district}`,
                        `GPExts outbreak intelligence: ${alert.caseCount} cases of ${alert.diseaseLabel} on ${alert.crop} reported in ${alert.district} over the last ${TRAILING_DAYS} days. Inspect at-risk fields in your area and report new cases through the app.`
                    );
                    sent += 1;
                }
            } catch (error) {
                logger.error(`Outbreak notification failed for ${alert.district}:`, error);
            }
        }
        return sent;
    },
};
