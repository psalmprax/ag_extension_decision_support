import { useCallback, useEffect, useReducer } from 'react';
import type { BoundaryMethod, BoundaryPoint } from '@ag-extension/shared/api';
import { MAX_BOUNDARY_POINTS } from '@ag-extension/shared/api';
import { finishWalk, judgeWalkFix, median, type FieldBoundary, type WalkFix, type WalkVerdict } from './boundaryModel';

export type GpsState = 'idle' | 'walking' | 'denied' | 'unsupported';

export interface BoundaryDraft {
  method: BoundaryMethod;
  points: BoundaryPoint[];
  /** GPS error of each walked point, in metres. */
  accuracies: number[];
  gps: GpsState;
  /** The phone lost its GPS fix for now; walking goes on and resumes with the next fix. */
  signalLost: boolean;
  lastFix: (WalkFix & { verdict: WalkVerdict }) | null;
}

type Action =
  | { type: 'method'; method: BoundaryMethod }
  | { type: 'tap'; point: BoundaryPoint }
  | { type: 'fix'; fix: WalkFix }
  | { type: 'gps'; gps: GpsState }
  | { type: 'signal_lost' }
  | { type: 'stop' }
  | { type: 'undo' }
  | { type: 'clear' };

const EMPTY: Pick<BoundaryDraft, 'points' | 'accuracies' | 'lastFix' | 'signalLost'> = { points: [], accuracies: [], lastFix: null, signalLost: false };

function reducer(draft: BoundaryDraft, action: Action): BoundaryDraft {
  switch (action.type) {
    case 'method':
      return draft.method === action.method ? draft : { ...draft, ...EMPTY, method: action.method, gps: 'idle' };
    case 'tap':
      if (draft.method !== 'drawn' || draft.points.length >= MAX_BOUNDARY_POINTS) return draft;
      return { ...draft, points: [...draft.points, action.point] };
    case 'fix': {
      if (draft.gps !== 'walking') return draft;
      const verdict = draft.points.length >= MAX_BOUNDARY_POINTS ? 'too_close' : judgeWalkFix(draft.points, action.fix);
      const lastFix = { ...action.fix, verdict };
      if (verdict !== 'accepted') return { ...draft, lastFix, signalLost: false };
      return {
        ...draft,
        lastFix,
        signalLost: false,
        points: [...draft.points, { lat: action.fix.lat, lng: action.fix.lng }],
        accuracies: [...draft.accuracies, action.fix.accuracy],
      };
    }
    case 'gps':
      return { ...draft, gps: action.gps, signalLost: false };
    case 'signal_lost':
      return draft.gps === 'walking' ? { ...draft, signalLost: true } : draft;
    case 'stop': {
      const points = finishWalk(draft.points, median(draft.accuracies));
      return { ...draft, gps: 'idle', signalLost: false, points };
    }
    case 'undo':
      return { ...draft, points: draft.points.slice(0, -1), accuracies: draft.accuracies.slice(0, -1) };
    case 'clear':
      return { ...draft, ...EMPTY, gps: draft.gps === 'walking' ? 'walking' : 'idle' };
  }
}

function initialDraft(initial: FieldBoundary | null): BoundaryDraft {
  return {
    method: initial?.method ?? 'walked',
    points: initial?.points ?? [],
    // A saved walk keeps its typical error for every point until it is walked again.
    accuracies: initial?.accuracyM ? initial.points.map(() => initial.accuracyM as number) : [],
    gps: 'idle',
    signalLost: false,
    lastFix: null,
  };
}

/** The boundary being mapped: tapped corners, or GPS fixes while the person walks the edge. */
export function useBoundaryDraft(initial: FieldBoundary | null) {
  const [draft, dispatch] = useReducer(reducer, initial, initialDraft);
  const walking = draft.gps === 'walking';

  useEffect(() => {
    if (!walking) return undefined;
    const watchId = navigator.geolocation.watchPosition(
      position => dispatch({ type: 'fix', fix: { lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy } }),
      // Only a refusal ends the walk; a lost fix or a timeout is temporary under trees or near buildings.
      error => dispatch(error.code === error.PERMISSION_DENIED ? { type: 'gps', gps: 'denied' } : { type: 'signal_lost' }),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30_000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [walking]);

  const startWalking = useCallback(() => {
    dispatch({ type: 'gps', gps: typeof navigator !== 'undefined' && navigator.geolocation ? 'walking' : 'unsupported' });
  }, []);

  const boundary = useCallback((): FieldBoundary => {
    const accuracy = draft.method === 'walked' ? median(draft.accuracies) : null;
    return { points: draft.points, method: draft.method, accuracyM: accuracy === null ? null : Math.round(accuracy * 10) / 10 };
  }, [draft]);

  return {
    draft,
    walking,
    boundary,
    startWalking,
    stopWalking: () => dispatch({ type: 'stop' }),
    setMethod: (method: BoundaryMethod) => dispatch({ type: 'method', method }),
    tap: (point: BoundaryPoint) => dispatch({ type: 'tap', point }),
    undo: () => dispatch({ type: 'undo' }),
    clear: () => dispatch({ type: 'clear' }),
  };
}
